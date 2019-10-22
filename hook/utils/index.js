module.exports = {
  capitalize (str) {
    return str.split(' ')
      .map(s => {
        if (!s) {
          return ''
        }

        return s[0].toUpperCase() + s.slice(1).toLowerCase()
      })
      .join(' ')
  },

  /**
   * Unique
   *
   * @param {Array} array
   */
  unique (array) {
    return [...new Set(array)]
  },

  difference (arr1, arr2) {
    return [arr1, arr2].reduce((a, b) => a.filter(c => !b.includes(c)))
  },

  /**
   * Set object value using dot notation (a.b.c)
   * @param {*} object
   * @param {*} path
   * @param {*} value
   * @param {*} formatKey
   */
  setValue (object, path, value, formatKey) {
    const keys = path.split('.')
    const len = keys.length
    let target = object

    for (let i = 0; i < len; i++) {
      const key = typeof formatKey === 'function' ? formatKey(keys[i]) : keys[i]

      if (i === len - 1) {
        target[key] = value
        break
      }

      if (!target[key]) {
        target[key] = {}
      }

      target = target[key]
    }

    return object
  },

  /**
   * Exclude some keys from an object
   *
   * @param {object} object
   * @param {string|array} keys
   */
  omit (object, keys) {
    keys = Array.isArray(keys) ? keys : [keys]
    return Object.keys(object).reduce((obj, key) => {
      if (!keys.includes(key)) {
        obj[key] = object[key]
      }
      return obj
    }, {})
  },

  /**
   * Pick only some keys from an object
   *
   * @param {Object} object
   * @param {String|Array} keys
   */
  pick (object, keys) {
    keys = Array.isArray(keys) ? keys : [keys]
    return keys.reduce((obj, key) => {
       if (object && object.hasOwnProperty(key)) {
          obj[key] = object[key]
       }
       return obj
     }, {})
  },

  /**
   * Run cb on each object values
   *
   * @param {Object} object
   * @param {Function} cb
   */
  eachObjectValues (object, cb) {
    Object.keys(object).forEach(key => {
      cb(object[key], key)
    })
  },

  /**
   * Check if cb return true for some object values
   *
   * @param {*} object
   * @param {*} cb
   */
  someObjectValues (object, cb) {
    return Object.values(object).some(cb)
  }
}

