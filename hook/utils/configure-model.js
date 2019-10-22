const path = require('path')
const pluralize = require('pluralize')
const deepmerge = require('deepmerge')
const machine = require('machine')

const createTransformer = require('./create-transformer')
const createModelValidator = require('./create-model-validation-rules')

module.exports = function configureModel (Model, appPath, config) {
  // Resource configuration
  let resourceConfig = Model.resource || {}

  // If resource is explicitly disabled on a model, skip
  if (!resourceConfig) {
    return
  }

  resourceConfig = deepmerge({
    path: pluralize(Model.identity),
    identifiers: [Model.primaryKey],
    validators: {},
    defaultIncludes: [],
    availableIncludes: Model.associations.map(assoc => assoc.alias),
  }, resourceConfig)

  if (resourceConfig.path[0] === '/') {
    resourceConfig.path = resourceConfig.path.substring(1)
  }

  resourceConfig.url = config.prefix + '/' + resourceConfig.path

  // Validators configuration
  if (resourceConfig.validators.create) {
    if (typeof resourceConfig.validators.create === 'string') {
      resourceConfig.validators.create = require(path.join(
        appPath,
        'api',
        config.paths.validators,
        resourceConfig.validators.create
      ))
    }
  } else {
    // create validation from model attributes
    resourceConfig.validators.create = createModelValidator(Model)
  }

  if (resourceConfig.validators.update) {
    if (typeof resourceConfig.validators.update === 'string') {
      resourceConfig.validators.update = require(path.join(
        appPath,
        'api',
        config.paths.validators,
        resourceConfig.validators.update
      ))
    }
  } else {
    // create validation from model attributes
    // Model.validations.update = createModelValidator(Model, true)
    // TODO: generate validation only for unique field
  }

  // Transformer configuration
  if (resourceConfig.transformer && typeof resourceConfig.transformer === 'string') {
    resourceConfig.transformer = require(path.join(
      appPath,
      'api',
      config.paths.transformers,
      resourceConfig.transformer
    ))
  }

  resourceConfig.transformer = createTransformer(Model, resourceConfig.transformer, config)

  // Observers configuration
  // We assume that the observer is located in observers dir with model identity as name
  const observerPath = path.join(
    appPath,
    'api',
    config.paths.observers,
    Model.identity
  )

  try {
    resourceConfig.observer = require(observerPath)
  } catch {
    resourceConfig.observer = {}
  }

  // Custom actions to handle how relations are created, updated, deleted or populated
  resourceConfig.actions = resourceConfig.actions ? Model.actions : {}

  Object.keys(resourceConfig.actions).forEach(actionName => {
    if (typeof resourceConfig.actions[actionName] === 'string') {
      // use it as node-machine
      const actionPath = path.join(
        appPath,
        'api/controllers',
        resourceConfig.actions[actionName]
      )

      try {
        resourceConfig.actions[actionName] = machine(require(actionPath))
      } catch {
        // Noop
        resourceConfig.actions[actionName] = null
      }
    }
  })

  // check if associations are well defined
  Model.associations.forEach(assoc => {
    if (assoc.type === 'collection' && !assoc.via) {
      throw new Error(
        `Association ${assoc.alias} defined on ${Model.identity} is invalid. You must define "via"`
      )
    }
  })

  Model.resource = resourceConfig
}
