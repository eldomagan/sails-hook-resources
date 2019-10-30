const actionsUtils = require('../utils/actions')

module.exports = async function findAction (req, res) {
  const options = actionsUtils.parseResourceRequest(req)

  if (Object.keys(req.query).includes('_count')) {
    return res.status(200).json({
      count: await actionsUtils.count(req.options._model, options._criteria)
    })
  }

  const Model = sails.models[req.options._model]
  const total = await actionsUtils.count(options._model, options._criteria)
  const records = await actionsUtils.find(options)

  return res.status(200).json(Model.resource.transformer.paginate(
    records,
    {
      total,
      count: records.length,
      from: (options._criteria.skip || 0) + records.length > 0 ? 1 : 0,
      to: (options._criteria.skip || 0) + records.length
    }
  ))
}
