module.exports = async function existsRule (inputs, field, message, args, get) {
  const value = get(inputs, field)

  if (!value) {
    return
  }

  const [model, attr = field] = args
  const queryCriteria = {}

  queryCriteria[attr] = value

  const row = await sails.models[model.toLowerCase()].findOne(queryCriteria)

  if (!row) {
    throw message
  }

  return true
}
