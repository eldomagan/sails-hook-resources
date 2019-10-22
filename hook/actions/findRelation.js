const { setValue } = require('../utils')
const actionsUtils = require('../utils/actions')

module.exports = async function findAction (req, res) {
  const { _model, _parent, _type, _relation, _via } = req.options
  const { parentId, id } = req.params

  const ParentModel = sails.models[_parent]
  const parentWhere = {}

  if (ParentModel.resource.identifiers.length > 1) {
    parentWhere.or = ParentModel.resource.identifiers.map(id => ({ [id]: parentId }))
  } else {
    parentWhere[ParentModel.resource.identifiers[0]] = parentId
  }

  const parentRecord = await ParentModel.findOne(parentWhere)

  if (!parentRecord) {
    return res.status(404).json({
      message: `Resource with id ${parentId} not found`
    })
  }

  const Model = sails.models[_model]
  const options = actionsUtils.parseResourceRequest(req)

  if (id) {
    const where = {}

    if (Model.resource.identifiers.length > 1) {
      where.or = Model.resource.identifiers.map(key => ({ [key]: id }))
    } else {
      where[Model.resource.identifiers[0]] = id
    }

    setValue(options, '_criteria.where', where)

    const records = await actionsUtils.find(options)

    if (records.length === 0) {
      return res.status(404).json({
        message: `Resource with id ${id} not found`
      })
    }

    return res.status(200).json(records[0])
  }

  if (_type === 'model') {
    setValue(options, '_criteria.where', {
      [Model.primaryKey]: parentRecord[_relation]
    })
  } else {
    options._parentPkValue = parentId
    options._type = Model.attributes[_via].model ? 'hasMany' : 'manyToMany'
    options._parent = _parent
    options._self = _relation
    options._via = _via
  }

  let records = await actionsUtils.find(options)

  if (_type === 'model') {
    records = records.length > 0 ? records[0] : null
  }

  return res.ok(records)
}
