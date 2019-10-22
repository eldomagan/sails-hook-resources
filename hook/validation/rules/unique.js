module.exports = async function uniqueRule (inputs, field, message, args, get) {
  let [model, attr, ignoreKey, ignoreValue] = args
  const value = get(inputs, field)

  if (!value) {
    return
  }

  const queryCriteria = {}

  attr = attr || field
  queryCriteria[attr] = value

  if (ignoreKey) {
    ignoreValue = ignoreValue || value
    queryCriteria[ignoreKey] = {
      '!=': ignoreValue
    }
  }

  const row = await sails.models[model.toLowerCase()].findOne(queryCriteria)

  if (row) {
    throw message
  }

  return true
}
