function Transformer (Model, options, config) {
  this._meta = {}
  this._Model = Model
  this._options = options || {}
  this._config = config || {}
}

Transformer.prototype.meta = function (key, value) {
  this._meta[key] = value
  return this
}

Transformer.prototype.item = function (record, ignoresMeta = false) {
  if (typeof this._options.item === 'function') {
    record = this._options.item.call(this, record)
  }

  if (!ignoresMeta && Object.keys(this._meta).length > 0) {
    const response =  {
      data: record,
      meta: this._meta
    }

    this._meta = {}

    return response
  }

  return record
}

Transformer.prototype.collection = function (records) {
  if (typeof this._options.collection === 'function') {
    records = this._options.collection.call(this, records)
  } else {
    records = records.map(item => this.item(item, true))
  }

  if (Object.keys(this._meta).length > 0) {
    const response = {
      data: records,
      meta: this._meta
    }

    this._meta = {}

    return response
  }

  return records
}

Transformer.prototype.paginate = function (records, { total }) {
  return this
    .meta('pagination', {
      total
    })
    .collection(records)
}

module.exports = function createTransformer (Model, options, config) {
  return new Transformer(Model, options, config)
}
