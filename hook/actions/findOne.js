const actionsUtils = require('../utils/actions')
const { setValue } = require('../utils')

module.exports = async function findOneAction (req, res) {
  const options = actionsUtils.parseResourceRequest(req)
  const Model = sails.models[options._model]
  const where = {}

  if (Model.resource.identifiers.length > 1) {
    where.or = Model.resource.identifiers.map(id => ({ [id]: req.params.id }))
  } else {
    where[Model.resource.identifiers[0]] = req.params.id
  }

  setValue(options, '_criteria.where', where)

  const records = await actionsUtils.find(options)

  if (records.length) {
    return res.status(200).json(
      Model.resource.transformer.item(records[0])
    )
  }

  return res.notFound({
    message: 'Resource with id' + req.params.id + ' not found'
  })
}
