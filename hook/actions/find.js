const actionsUtils = require('../utils/actions')

module.exports = async function findAction (req, res) {
  if (Object.keys(req.query).includes('_count')) {
    return res.status(200).json({
      count: await actionsUtils.count(req.options._model, req.query)
    })
  }

  const Model = sails.models[req.options._model]
  const options = actionsUtils.parseResourceRequest(req)
  const records = await actionsUtils.find(options)
  const total = await actionsUtils.count(options._model, options._criteria)

  return res.status(200).json(Model.resource.transformer.paginate(
    records,
    {
      total
    }
  ))
}
