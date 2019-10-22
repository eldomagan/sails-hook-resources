const actionsUtils = require('../utils/actions')
const validate = require('../validation')

module.exports = async function createAction (req, res) {
  const options = actionsUtils.parseResourceRequest(req)
  const Model = sails.models[options._model]

  const inputs = await validate(req, res, Model.resource.validators.create)

  if (inputs) {
    return res.status(201).json(Model.resource.transformer.item(
      await actionsUtils.create(options, inputs)
    ))
  }
}
