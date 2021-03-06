const knex = require('knex')
const app = require('../src/app')
const bcrypt = require('bcryptjs')
const helpers = require('./test-helpers')

describe.only('Users Endpoints', function() {
  let db

  const { testUsers } = helpers.makeThingsFixtures()

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    })
    app.set('db', db)
  })

  after('disconnect from db', () => db.destroy())

  before('cleanup', () => helpers.cleanTables(db))

  afterEach('cleanup', () => helpers.cleanTables(db))

  describe(`POST /api/users`, () => {
    context(`User Validation`, () => {
      beforeEach('insert users', () =>
        helpers.seedUsers(
          db,
          testUsers,
        )
      )

      const requiredFields = ['user_name', 'password', 'full_name']

      requiredFields.forEach(field => {
        const registerAttemptBody = {
          user_name: 'test user_name',
          password: 'test password',
          full_name: 'test full_name',
          nickname: 'test nickname',
        }

        it(`responds with 400 required error when '${field}' is missing`, () => {
          delete registerAttemptBody[field]

          return supertest(app)
            .post('/api/users')
            .send(registerAttemptBody)
            .expect(400, {
              error: `Missing '${field}' in request body`,
            })
        })
      })

        it('responds 400 "Password must be longer than 8 characters" when empty password', () => {
          const userShortPass = {
            user_name: 'test user_name',
            password: '11AAaa!',
            full_name: 'test full_name'
          }
          return supertest(app)
            .post('/api/users')
            .send(userShortPass)
            .expect(400, { error: 'Password must be longer than 8 characters'})
        })

        it('responds 400 "Password cannot be longer than 72 characters" when long password', () => {
          const userLongPass = {
            user_name: 'test user_name',
            password: '*'.repeat(73),
            full_name: 'test full_name'
          }
          return supertest(app)
            .post('/api/users')
            .send(userLongPass)
            .expect(400, { error: 'Password cannot be longer than 72 characters'})
        })

        it('responds 400 "Password cannot start or end with a space" when starts with space', () => {
          const userSpaceBeginPass = {
            user_name: 'test user_name',
            password: ' 11AAaa!!',
            full_name: 'test full_name'
          }
          return supertest(app)
            .post('/api/users')
            .send(userSpaceBeginPass)
            .expect(400, { error: 'Password cannot start or end with a space'})
        })

        it('responds 400 "Password cannot start or end with a space" when ends with space', () => {
          const userSpaceEndPass = {
            user_name: 'test user_name',
            password: '11AAaa!! ',
            full_name: 'test full_name'
          }
          return supertest(app)
            .post('/api/users')
            .send(userSpaceEndPass)
            .expect(400, { error: 'Password cannot start or end with a space'})
        })

        it('responds 400 "Password must contain 1 upper case, lower case, number and special character" when not complex enough', () => {
          const userNotComplexPass = {
            user_name: 'test user_name',
            password: '11AAAA!!',
            full_name: 'test full_name'
          }
          return supertest(app)
            .post('/api/users')
            .send(userNotComplexPass)
            .expect(400, { error: 'Password must contain 1 upper case, lower case, number and special character'})
        })

        it('responds 400 "Username already taken" when username taken', () => {
          const testUser = testUsers[0];
          const duplicateUser = {
            user_name: testUser.user_name,
            password: '11AAaa!!',
            full_name: 'test full_name'
          }
          return supertest(app)
            .post('/api/users')
            .send(duplicateUser)
            .expect(400, { error: 'Username already taken'})
        })
    })

    context('Happy path', () => {
      it('responds 201, serialized user, storing bcrypted password', () => {
        const newUser = {
          user_name: 'test user_name',
          password: '11AAaa!!',
          full_name: 'test full_name'
        }
        return supertest(app)
        .post('/api/users')
        .send(newUser)
        .expect(201)
        .expect(res => {
          expect(res.body).to.have.property('id')
          expect(res.body.user_name).to.eql(newUser.user_name)
          expect(res.body.full_name).to.eql(newUser.full_name)
          expect(res.body.nickname).to.eql('')
          expect(res.body).to.not.have.property('password')
          expect(res.headers.location).to.eql(`/api/users/${res.body.id}`)
          const expectedDate = new Date().toLocaleString('en', { timeZone: 'UTC' })
          const actualDate = new Date(res.body.date_created).toLocaleString()
          expect(actualDate).to.equal(expectedDate)
        })
        .expect(res => {
          db
            .from('thingful_users')
            .select('*')
            .where({ id: res.body.id })
            .first()
            .then(row => {
              expect(row.user_name).to.eql(newUser.user_name)
              expect(row.full_name).to.eql(newUser.full_name)
              expect(row.nickname).to.eql(null)
              const expectedDate = new Date().toLocaleString('en', { timeZone: 'UTC' })
              const actualDate = new Date(row.date_created).toLocaleString()
              expect(actualDate).to.eql(expectedDate)

              return bcrypt.compare(newUser.password, row.password)
            })  
            .then(compareMatch => {
              expect(compareMatch).to.be.true
            })
        })

      })
    })
  })
})