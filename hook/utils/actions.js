const parseResourceOptions = require('./parse-resource-options')
const { omit, pick, capitalize, difference } = require('.')

/**
 * Factory to create a function that create a related model
 *
 * @param {*} Model
 * @param {String} relation
 * @param {Object} association the association metadata
 */
function _createRelationCreateFn (options) {
  const customCreateFnName = 'create' + capitalize(options._self)
  let createFn = sails.models[options._parent].resource.actions[customCreateFnName]

  if (!createFn && options._type !== 'custom') {
    createFn = function (inputs) {
      return create(options, inputs)
    }
  }

  return createFn
}

/**
 * Factory to create a function that update a related model
 *
 * @param {*} Model
 * @param {String} relation
 * @param {Object} association the association metadata
 */
function _createRelationUpdateFn (Model, relation, association) {
  const customUpdateFnName = 'update' + capitalize(relation)
  let updateFn = Model.resource.actions[customUpdateFnName]

  if (!updateFn) {
    updateFn = function (data, id) {
      const modelIdentity = association.model || association.collection
      return update(
        sails.models[modelIdentity],
        { [sails.models[modelIdentity].primaryKey]: id },
        data
      )
    }
  }

  return updateFn
}

function parseResourceRequest (req) {
  return parseResourceOptions(req)
}

/**
 * Find records and requested populate
 *
 * @param {Object} options
 */
async function find (options) {
  const Model = sails.models[options._model]
  const directIncludes = options._relations.filter(
    inc => !options[inc]._relations
  )
  const deepIncludes = options._relations.filter(
    inc => options[inc]._relations && options[inc]._relations.length
  )

  let rootQuery

  if (options._type === 'manyToMany' && options._parentPkValue) {

    const subResult = await sails.models[options._parent]
      .findOne(options._parentPkValue)
      .populate(options._self, options._criteria)

    const pks = subResult[options._self].map(item => item[options._pk])
    rootQuery = Model.find({ [options._pk]: pks })

  } else if (options._type === 'hasMany' && options._parentPkValue) {

    const criteria = Object.assign(
      {},
      options._criteria,
      { [options._via]: options._parentPkValue }
    )

    rootQuery = Model.find(criteria)

  } else if (options._type === 'belongsTo' && options._pkValue) {

    rootQuery = Model.findOne({ [options._pk]: options._pkValue })

  } else {

    rootQuery = Model.find(options._criteria)

  }

  directIncludes.forEach(inc => {
    if (options[inc]._type === 'belongsTo') {
      rootQuery.populate(inc)
    } else {
      rootQuery.populate(inc, options[inc]._criteria)
    }
  })

  function deepPopulates (records) {
    if (!records) {
      return
    }

    records = Array.isArray(records) ? records : [records]

    return Promise.all(deepIncludes.map(inc => {
      return Promise.all(records.map((record, index) => {
        const includeOptions = Object.assign({}, options[inc])

        if (includeOptions._type === 'belongsTo') {
          if (!record[inc]) {
            return null
          }

          includeOptions._pkValue = record[inc]
        } else {
          includeOptions._parentPkValue = record[options._pk]
        }

        return find(includeOptions).then(result => {
          records[index][inc] = result
        })
      }))
    }))
  }

  const records = await rootQuery

  await deepPopulates(records)

  return records
}

/**
 * Create new record and it's associations
 *
 * @param {Object} Model
 * @param {Object} inputs
 */
async function create (options, inputs) {
  const Model = sails.models[options._model]

  if (Array.isArray(inputs)) {
    return Promise.all(inputs.map(data => create(options, data)))
  }

  if (typeof inputs !== 'object') {
    return {
      [options._pk]: inputs
    }
  }

  if (inputs[options._pk]) {
    return inputs
  }

  sails.emit('restapi:creating', Model.identity, inputs)
  sails.emit(`restapi:creating:${Model.identify}`, inputs)

  if (Model.resource.observer && typeof Model.resource.observer.creating === 'function') {
    await Model.resource.observer.creating(inputs)
  }

  const modelInputs = pick(omit(inputs, options._relations), Object.keys(Model.attributes))

  if (Object.keys(pick(inputs, options._relations)).length === 0) {
    const record = await Model.create(modelInputs).fetch()

    sails.emit('restapi:created', Model.identity, record)
    sails.emit(`restapi:created:${Model.identify}`, record)

    if (Model.resource.observer && Model.resource.observer.created) {
      await Model.resource.observer.created(record, inputs)
    }

    return record
  }

  const relationsCreateFns = options._relations.reduce((fns, relation) => {
    fns[relation] = _createRelationCreateFn (options[relation])
    return fns
  }, {})

  let response = {}

  const belongsToRelations = options._relations.filter(key => {
    return options[key]._type === 'belongsTo' ||
      options[key]._custom_type === 'belongsTo'
  })

  const belongsToPromises = belongsToRelations
    .filter(relation => !!relationsCreateFns[relation])
    .map(async relation => {
      const record = await relationsCreateFns[relation](inputs[relation])

      if (record) {
        if (options[relation]._type === 'custom' && options[relation]._via) {
          modelInputs[options[relation]._via] = record[options[relation]._pk]
        } else {
          modelInputs[relation] = record[options[relation]._pk]
        }

        response[relation] = record
      }
    })

  await Promise.all(belongsToPromises)

  const createdRecord = await Model.create(modelInputs).fetch()

  response = Object.assign({}, omit(createdRecord, options._relations), response)

  const otherRelationsPromises = options._relations
    .filter(key => options[key]._type !== 'belongsTo' && relationsCreateFns[key])
    .map(async relation => {
      const relationOptions = options[relation]
      let data = inputs[relation]

      if (Array.isArray(data) && relationOptions._type === 'hasMany') {
        data = data.map(item => {
          item[relationOptions._via] = createdRecord[options._pk]
          return item
        })
      }

      if (relationOptions._type === 'manyToMany' && !Array.isArray(data)) {
        data = [data]
      }

      const records = await relationsCreateFns[relation](data)

      if (records) {
        response[relation] = records

        if (relationOptions._type === 'manyToMany') {
          await Model.addToCollection(
            createdRecord[options._pk],
            relation,
            records.map(item => item[relationOptions._pk])
          )
        }
      }
    })

  sails.emit('restapi:created', Model.identity, response)
  sails.emit(`restapi:created:${Model.identify}`, response)

  await Promise.all(otherRelationsPromises)

  if (Model.resource.observer && Model.resource.observer.created) {
    Model.resource.observer.created(response, inputs)
  }

  return response
}

/**
 * Update a record and update/create it's associations
 *
 * @param {Object} Model
 * @param {Object} inputs
 */
async function updateOne (Model, criteria, inputs) {
  inputs = Object.keys(Model.attributes)
    .reduce((result, attr) => {
      const input = inputs[attr]

      if (
        typeof input === 'object' &&
        !Array.isArray(input) &&
        Model.attributes[attr].model
      ) {
        const pk = Model.attributes[attr].primaryKey
        if (input[pk]) {
          inputs[attr] = input[pk]
        }
      } else if (inputs[attr]) {
        result[attr] = inputs[attr]
      }

      return result
    }, {})

  return Model.updateOne(criteria).set(inputs)
}

async function count (model, criteria) {
  const Model = sails.models[model]
  return await Model.count(criteria.where)
}

module.exports = {
  parseResourceRequest,
  find,
  create,
  updateOne,
  count
}
