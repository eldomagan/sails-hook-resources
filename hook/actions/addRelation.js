const actionsUtils = require('../utils/actions')
const validate = require('../validation')

module.exports = async function addRelationAction (req, res) {
  const { _parent, _relation, _model, _via } = req.options
  const options = actionsUtils.parseResourceRequest(req)
  const Model = sails.models[_model]

  let inputs = req.body
  inputs = Array.isArray(inputs) ? inputs : [inputs]

  inputs = await Promise.all(inputs.map(data => {
    if (typeof data !== 'object') {
      data = { [Model.primaryKey]: data }
    }

    if (data[Model.primaryKey]) {
      return Promise.resolve(data)
    }

    if (Model.attributes[_via].model) {
      data[_via] = req.params.parentId
    }

    return validate(req, res, Model.resouce.validators.create, data)
  }))

  if (inputs.every(i => !!i)) {
    const records = await actionsUtils.create(options, inputs)

    if (Model.attributes[_via].collection) {
      await sails.models[_parent].addToCollection(
        parentId,
        _relation,
        records.map(item => item[Model.primaryKey])
      )
    }

    return res.status(200).json(records)
  }
}
