module.exports = async function deleteAction (req, res) {
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

  await Model.destroyOne({
    [Model.primaryKey]: record[Model.primaryKey]
  })

  return res.status(200).json(record)
}
