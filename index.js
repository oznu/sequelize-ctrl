'use strict'

const inflection = require('inflection')

module.exports = (model, Sequelize) => {
  const ctrl = {}

  /**
   * Middleware Only - Pagination Helper
   */
  ctrl.paginate = (req, res, next) => {
    if (req.query.page) {
      req.query.page = parseInt(req.query.page) || 1
      if (req.query.page <= 1) {
        req.query.page = 1
      }
      req.query.limit = parseInt(req.query.limit) || 25
      req.query.orderBy = req.query.orderBy || model.primaryKeyField
      req.query.offset = (req.query.limit * (req.query.page - 1))

      return model.count({
        where: Sequelize.Validator.isJSON(req.query.where || '') ? JSON.parse(req.query.where) : req.body.where || {}
      })
      .then((count) => {
        res.header('X-Page-Total-Items', count)
        res.header('X-Page-Current', req.query.page)
        res.header('X-Page-Limit', req.query.limit)
        res.header('X-Page-Total-Pages', Math.ceil(count / req.query.limit))
        next()
      })
      .catch(next)
    } else {
      next()
    }
  }

  /**
   * GET /model
   * POST /model/search
   * Returns a list of results based on the search criteria.
   */
  ctrl.list = (req, res, next) => {
    return model.findAll({
      where: Sequelize.Validator.isJSON(req.query.where || '') ? JSON.parse(req.query.where) : req.body || {},
      attributes: req.query.attributes ? (Array.isArray(req.query.attributes) ? req.query.attributes : [req.query.attributes]) : undefined,
      limit: parseInt(req.query.limit) || undefined,
      offset: parseInt(req.query.offset) || undefined,
      order: req.query.orderBy ? [[req.query.orderBy, req.query.order || 'ASC']] : undefined
    })
    .then((data) => {
      res.json(data)
    }).catch(next)
  }

  /**
   * GET /model/scope/:scope
   * POST /model/scope/:scope
   * Allows access to all scopes declared on the model.
   */
  ctrl.scope = (req, res, next) => {
    return model.scope(req.params.scope).findAll({
      where: Sequelize.Validator.isJSON(req.query.where || '') ? JSON.parse(req.query.where) : req.body || {},
      attributes: req.query.attributes ? (Array.isArray(req.query.attributes) ? req.query.attributes : [req.query.attributes]) : undefined,
      limit: parseInt(req.query.limit) || undefined,
      offset: parseInt(req.query.offset) || undefined,
      order: req.query.orderBy ? [[req.query.orderBy, req.query.order || 'ASC']] : undefined
    })
    .then((data) => {
      res.json(data)
    }).catch(next)
  }

  /**
   * PUT /model/:id/method/:method
   * Allows access to instanceMethods in the publicInstanceMethods array on the model.
   */
  ctrl.instanceMethod = (req, res, next) => {
    return model.findById(req.params.id)
      .then((data) => {
        if (data) {
          if (data.$modelOptions.publicInstanceMethods && data.$modelOptions.publicInstanceMethods.includes(req.params.method)) {
            return data[req.params.method](req.body)
          } else {
            res.status(404)
            throw new Error(`Method '${req.params.method}' Not Found On '${model}'`)
          }
        } else {
          res.status(404)
          throw new Error(`Instance of '${model}' Not Found`)
        }
      })
      .then((data) => {
        res.json(data)
      }).catch(next)
  }

  /**
   * POST /model
   * Creates a new instance of the model.
   */
  ctrl.create = (req, res, next) => {
    return model.create(req.body)
      .then((data) => {
        res.status(201).json(data)
      }).catch(next)
  }

  /**
   * GET /model/:id
   * Retrieves a single instance of the model by it's id.
   */
  ctrl.select = (req, res, next) => {
    return model.findById(req.params.id)
      .then((data) => {
        if (data) {
          res.json(data)
        } else {
          res.status(404)
          throw new Error(`Instance of '${model}' Not Found`)
        }
      }).catch(next)
  }

  /**
   * PUT /model/:id
   * Updates a single instance of a model.
   */
  ctrl.update = (req, res, next) => {
    return model.findById(req.params.id)
      .then((data) => {
        if (data) {
          return data.updateAttributes(req.body)
        } else {
          res.status(404)
          throw new Error(`Instance of '${model}' Not Found`)
        }
      }).then((data) => {
        res.json(data)
      }).catch(next)
  }

  /**
   * PATCH /model/:id
   * Updates a single instance of a model but will accept patial updates for JSON and JSONB column types.
   */
  ctrl.patch = (req, res, next) => {
    return model.findById(req.params.id)
      .then((data) => {
        if (data) {
          Object.keys(model.rawAttributes).forEach((column) => {
            if (['JSONB', 'JSON'].indexOf(model.rawAttributes[column].type.key) > -1) {
              req.body[column] = Object.assign(data[column], req.body[column])
            }
          })
          return data.updateAttributes(req.body)
        } else {
          res.status(404)
          throw new Error(`Instance of '${model}' Not Found`)
        }
      }).then((data) => {
        res.json(data)
      }).catch(next)
  }

  /**
   * DELETE /model/:id
   * Deletes a single instance of a model.
   */
  ctrl.destroy = (req, res, next) => {
    return model.destroy({
      where: {
        id: req.params.id
      },
      individualHooks: true
    }).then((data) => {
      res.sendStatus(202)
    }).catch(Sequelize.ForeignKeyConstraintError, (err) => {
      if (err) {
        throw new Error(`Cannot delete item as it is referenced by another object.
          Delete or amend any objects that reference this item then try again`)
      }
    }).catch(next)
  }

  /* Relations */

  /**
   * GET /model/:id/:relation
   * POST /model/:id/:relation/search
   * Returns linked models for 1:m or n:m relationships.
   */
  ctrl.relationList = (req, res, next) => {
    let rel = inflection.titleize(req.params.relation).replace('-', '')
    rel = inflection.pluralize(rel)
    return model.findById(req.params.id)
      .then((data) => {
        if (data) {
          return data[`get${rel}`]({
            where: Sequelize.Validator.isJSON(req.query.where || '') ? JSON.parse(req.query.where) : req.body || {},
            attributes: req.query.attributes ? (Array.isArray(req.query.attributes) ? req.query.attributes : [req.query.attributes]) : undefined,
            limit: parseInt(req.query.limit) || undefined,
            offset: parseInt(req.query.offset) || undefined,
            order: req.query.orderBy ? [[req.query.orderBy, req.query.order || 'ASC']] : undefined
          })
        } else {
          res.status(404)
          throw new Error(`Instance of '${model}' Not Found`)
        }
      }).then((data) => {
        res.json(data)
      }).catch(next)
  }

  /**
   * GET /model/:id/:relation
   * Returns a single linked model for a 1:1 relationships.
   */
  ctrl.relationParent = (req, res, next) => {
    let rel = inflection.titleize(req.params.relation).replace('-', '')
    rel = inflection.singularize(rel)
    return model.findById(req.params.id)
      .then((data) => {
        if (data) {
          return data[`get${rel}`]()
        } else {
          res.status(404)
          throw new Error(`Instance of '${model}' Not Found`)
        }
      }).then((data) => {
        res.json(data)
      }).catch(next)
  }

  /**
   * POST /model/:id/:relation
   * Creates a new instance linked to it's relation.
   */
  ctrl.relationCreate = (req, res, next) => {
    let rel = inflection.titleize(req.params.relation).replace('-', '')
    rel = inflection.singularize(rel)
    return model.findById(req.params.id)
      .then((data) => {
        if (data) {
          return data[`create${rel}`](req.body)
        } else {
          res.status(404)
          throw new Error(`Instance of '${model}' Not Found`)
        }
      }).then((data) => {
        res.status(201).json(data)
      }).catch(next)
  }

  /**
   * GET /model/:id/:relation/:relId
   * Retrieves a single model that is linked to it's relation.
   */
  ctrl.relationSelect = (req, res, next) => {
    let rel = inflection.titleize(req.params.relation).replace('-', '')
    rel = inflection.pluralize(rel)
    return model.findById(req.params.id)
      .then((data) => {
        if (data) {
          return data[`get${rel}`]({
            where: {
              id: req.params.relId
            }
          })
        } else {
          res.status(404)
          throw new Error(`Instance of '${model}' Not Found`)
        }
      }).then((data) => {
        if (data.length) {
          res.json(data[0])
        } else {
          res.status(404)
          throw new Error(`Instance of '${rel}' Not Found`)
        }
      }).catch(next)
  }

  /**
   * PUT /model/:id/:relation/:relId
   * Creates a relationship between two model instances.
   */
  ctrl.relationLink = (req, res, next) => {
    let rel = inflection.titleize(req.params.relation).replace('-', '')
    rel = inflection.singularize(rel)
    return model.findById(req.params.id)
      .then((data) => {
        if (data) {
          return data[`add${rel}`](req.params.relId)
        } else {
          res.status(404)
          throw new Error(`Instance of '${model}' Not Found`)
        }
      }).then((data) => {
        if (data.length && data[0].length) {
          res.json(data[0][0])
        } else {
          res.status(400)
          throw new Error(`Relation of '${rel}' and '${model}' Already Exists`)
        }
      }).catch(Sequelize.ForeignKeyConstraintError, (err) => {
        if (err) {
          res.status(404)
          throw new Error(`Instance of '${rel}' Not Found`)
        }
      }).catch(next)
  }

  /**
   * DELETE /model/:id/:relation/:relId
   * Deletes the relationship between two model instances. This does not delete the model instances.
   */
  ctrl.relationUnlink = (req, res, next) => {
    let rel = inflection.titleize(req.params.relation).replace('-', '')
    rel = inflection.singularize(rel)
    return model.findById(req.params.id)
      .then((data) => {
        if (data) {
          return data[`remove${rel}`](req.params.relId)
        } else {
          res.status(404)
          throw new Error(`Instance of '${model}' Not Found`)
        }
      }).then((data) => {
        res.json(data)
      }).catch(next)
  }

  return ctrl
}
