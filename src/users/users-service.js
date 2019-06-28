'use strict';

const xss = require('xss');
const bcrypt = require('bcryptjs');

const REGEX = /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&])[\S]+/

const UsersService = {
  hasUserWithUserName(db, user_name) {
    return db('thingful_users')
      .where({ user_name })
      .first()
      .then(user => !!user);
  },

  insertUser(db, newUser) {
    return db
      .insert(newUser)
      .into('thingful_users')
      .returning('*')
      .then(([user]) => user);
  },

  validatePassword(password) {
    if (password.length < 8) {
      return 'Password must be longer than 8 characters';
    }
    if(password.length > 72) {
      return 'Password cannot be longer than 72 characters';
    }
    if(password.startsWith(' ') || password.endsWith(' ')) {
      return  'Password cannot start or end with a space';
    }
    if(!REGEX.test(password)) {
      return 'Password must contain 1 upper case, lower case, number and special character';
    }
    return null;
  },

  hashPassword(password) {
    return bcrypt.hash(password, 12);
  },

  serializeUser(user) {
    return {
      id: user.id,
      full_name: xss(user.full_name),
      user_name: xss(user.user_name),
      nickname: xss(user.nick_name),
      date_created: new Date(user.date_created)
    };
  }
};

module.exports = UsersService;