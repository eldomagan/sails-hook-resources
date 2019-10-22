const actionsUtils = require('../utils/actions')
const validate = require('../validation')

module.exports = async function updateAction (req, res) {
  const Model = sails.models[req.options._model]
  const where = {}

  if (Model.resource.identifiers.length > 1) {
    where.or = Model.resource.identifiers.map(id => ({ [id]: req.params.id }))
  } else {
    where[Model.resource.identifiers[0]] = req.params.id
  }

  const record = await Model.findOne(where)

  if (!record) {
    return res.notFound({
      message: 'Resource with id' + req.params.id + ' not found'
    })
  }

  const inputs = await validate(req, res, Model.resource.validators.update)

  if (inputs) {
    const criteria = {
      [Model.primaryKey]: record[Model.primaryKey]
    }

    sails.emit('restapi:updating', Model.identity, inputs, record)
    sails.emit(`restapi:updating:${Model.identify}`, inputs, record)

    if (Model.resource.observer && typeof Model.resource.observer.updating === 'function') {
      await Model.resource.observer.updating(inputs, record)
    }

    const updatedRecord = await actionsUtils.updateOne(Model, criteria, inputs)

    sails.emit('restapi:updated', Model.identity, updatedRecord, record)
    sails.emit(`restapi:updated:${Model.identify}`, updatedRecord, record)

    if (Model.resource.observer && Model.resource.observer.updated) {
      await Model.resource.observer.updated(updatedRecord, record)
    }

    return res.status(200).json(
      Model.resource.transformer.item(updatedRecord)
    )
  }
}
