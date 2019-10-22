const { rule } = require('indicative')
const { omit, eachObjectValues } = require('.')

// Not available rules
// isHexColor, isNotEmptyString, isUUID, maxLength, minLength

module.exports = function createModelValidationRules (Model, update = false) {
  const rules = {}

  eachObjectValues(Model.attributes, (options, attribute) => {
    let attributeRules = []

    if (['id', 'createdAt', 'updatedAt'].includes(attribute)) {
      return
    }

    if (options.required) {
      attributeRules.push(rule('required'))
    }

    if (options.autoMigrations && options.autoMigrations.unique) {
      const args = [Model.identity, attribute]
      attributeRules.push(rule('unique', args))
    }

    Object.keys(omit(options, [
      'required', 'unique', 'type',
      'defaultsTo', 'allowNull', 'columnName',
      'encrypt', 'columnType',
      'autoCreatedAt', 'autoMigrations',
      'model', 'collection', 'via'
    ])).forEach(key => {
      let ruleName = key.replace('is', '')
      ruleName = ruleName[0] = ruleName[0].toLowerCase()
      attributeRules.push(rule(ruleName, [options[key]]))
    })

    rules[attribute] = attributeRules
  })

  return {
    rules
  }
}
