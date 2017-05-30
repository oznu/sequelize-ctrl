'use strict'

const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const Sequelize = require('sequelize')
const sequelizeCtrl = require('../')

/* Sequelize Setup */

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.resolve(__dirname, 'example.sqlite')
})

const User = sequelize.define('Users', {
  firstName: {
    type: Sequelize.STRING,
    allowNull: false
  },
  lastName: {
    type: Sequelize.STRING,
    allowNull: false
  }
})

const Car = sequelize.define('Cars', {
  userId: {
    type: Sequelize.INTEGER
  },
  type: {
    type: Sequelize.STRING,
    allowNull: false
  },
  color: {
    type: Sequelize.STRING,
    allowNull: false
  }
})

Car.belongsTo(User, {foreignKey: 'userId'})
User.hasMany(Car, {foreignKey: 'userId'})

sequelize.sync({force: true})

/* Sequelize-Ctrl + Express Setup */

const app = express()
const userCtrl = sequelizeCtrl(User, Sequelize)

app.use(bodyParser.json())

app.get('/users', userCtrl.paginate, userCtrl.list)
app.post('/users', userCtrl.create)

app.get('/users/:id', userCtrl.select)
app.put('/users/:id', userCtrl.update)
app.delete('/users/:id', userCtrl.destroy)

app.get('/users/:id/:relation(cars)', userCtrl.relationList)
app.post('/users/:id/:relation(cars)', userCtrl.relationCreate)
app.get('/users/:id/:relation(cars)/:relId', userCtrl.relationSelect)

app.use(userCtrl.handleError)

app.listen(4000)
