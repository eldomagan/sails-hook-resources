const flatten = require('flat')
const { sanitize, validateAll } = require('indicative')

function flattenRules (rules) {
  return Object.keys(rules).reduce((result, field) => {
    if (typeof rules[field] === 'object' && !Array.isArray(rules[field])) {
      const fieldRules = flatten({ [field]: rules[field] })
      Object.keys(fieldRules).forEach(f => {
        result[f] = fieldRules[f]
      })
    } else {
      result[field] = rules[field]
    }

    return result
  }, {})
}

module.exports = async function validate (req, res, validator, inputs) {
  inputs = inputs || req.body

  if (!validator) {
    return inputs
  }

  if (validator.headers) {
    if (typeof validator.headers === 'string') {
      validator.headers = [validator.headers]
    }

    if (Array.isArray()) {
      validator.headers.forEach(header => {
        inputs[header] = req.header(header)
      })
    } else if (typeof validator.headers === 'object') {
      Object.keys(validator.headers).forEach(key => {
        inputs[key] = req.header(validator.headers[key])
      })
    }
  }

  if (validator.sanitize) {
    inputs = await sanitize(inputs, validator.sanitize)
  }

  if (typeof validator.inputs === 'function') {
    inputs = await validator.inputs(inputs, req)
  }


  if (!validator.hasOwnProperty('rules')) {
    return inputs
  }

  let rules = typeof validator.rules === 'function'
    ? await validator.rules(req, inputs)
    : validator.rules

  rules = flattenRules(rules)

  let messages = typeof validator.messages === 'function'
    ? await validator.messages(req)
    : validator.messages

  try {
    await validateAll(inputs, rules, messages)
    return inputs
  } catch (errors) {
    res.status(400).json({
      status: 'error',
      errors
    })
  }
}
