const unflatten = require('flat').unflatten;
const { capitalize, unique, setValue, omit, pick } = require('.');

const parseValueToPrimitive = value => {
  if (value === 'false') {
    return false
  } else if (value === 'true') {
    return true
  } else if (value === 'null') {
    return null
  } else {
    return value
  }
}

const OPERATORS_MAP = {
  'eq': '=',
  'ne': '!=',
  'neq': '!=',
  'lt': '<',
  'gt': '>',
  'lte': '<=',
  'gte': '>=',
  'sw': 'startsWith',
  'ew': 'endsWith',
  'like': 'contains'
};

function injectLimitIntoCriteria (value, obj, prefix = '') {
  if (!value) {
    return;
  }

  if (typeof value === 'string') {
    setValue(obj, prefix + 'limit', value);
  } else if (Array.isArray(value)) {
    value.forEach(item => {
      injectLimitIntoCriteria(item, obj, prefix);
    });
  } else {
    Object.keys(value).forEach(key => {
      const val = value[key] === true ? key : value[key];
      prefix = /^[0-9]*$/.test(key) ? prefix : prefix + key + '.';
      injectLimitIntoCriteria(val, obj, prefix);
    });
  }
}

function injectSortIntoCriteria (value, obj, prefix = '') {
  if (!value) {
    return;
  }

  if (typeof value === 'string') {
    setValue(obj, prefix + 'sort.' + value, 'asc');
  } else if (Array.isArray(value)) {
    value.forEach(item => {
      injectSortIntoCriteria(item, obj, prefix);
    });
  } else {
    Object.keys(value).forEach(key => {
      if (['desc', 'asc'].includes(value[key])) {
        setValue(obj, prefix + 'sort.' + key, value[key]);
      } else {
        prefix = /^[0-9]*$/.test(key) ? prefix : prefix + key + '.';
        injectSortIntoCriteria(value[key], obj, prefix);
      }
    });
  }
}

function parseIncludes (includes = [], Model) {
  const availableIncludes = Model.resource.availableIncludes || [];
  const defaultIncludes = Model.resource.defaultIncludes || [];

  if (availableIncludes.length === 0) {
    return [];
  }

  if (!Array.isArray(includes)) {
    includes = includes.split(',').map(i => i.trim()).filter(i => !!i);
  }

  includes = defaultIncludes.concat(includes);

  return unique(
    includes.filter(include => availableIncludes.includes(include))
  );
}

function buildPopulateGraph (model, includes, criteria, relations = []) {
  const associations = sails.models[model].associations;
  const tree = {
    _model: model,
    _pk: sails.models[model].primaryKey,
    _relations: relations
  };

  includes.forEach(include => {
    const relation = include.split('.')[0];
    const association = associations.find(assoc => assoc.alias === relation);

    if (!tree[relation]) {
      tree._relations.push(relation);
      tree[relation] = {
        _self: relation,
        _parent: model,
        _model: association.model || association.collection,
        _via: association.via
      };

      if (association.type === 'model') {
        tree[relation]._type = 'belongsTo';
      } else {
        const relatedAssociation = sails.models[tree[relation]._model]
          .attributes[association.via];

        if (relatedAssociation.model) {
          tree[relation]._type = 'hasMany';
        } else {
          tree[relation]._type = 'manyToMany';
        }
      }
    }

    const index = include.indexOf('.');
    let relationCriteria = {};

    if (typeof criteria[relation] === 'object' && !Array.isArray(criteria[relation])) {
      relationCriteria = criteria[relation];
      delete criteria[relation];

      Object.keys(relationCriteria).forEach(key => {
        if (Object.keys(OPERATORS_MAP).includes(key) || Object.values(OPERATORS_MAP).includes(key)) {
          if (!criteria[relation]) {
            criteria[relation] = {}
          }
          criteria[relation][key] = relationCriteria[key]
          delete relationCriteria[key]
        }
      })
    }

    if (index !== -1) {
      // TODO: refactor multiple child include
      tree[relation] = {
        ...tree[relation],
        ...buildPopulateGraph(
          tree[relation]._model,
          [include.substr(index + 1)],
          relationCriteria,
          tree[relation]._relations
        )
      };
    } else {
      tree[relation]._criteria = relationCriteria;
    }
  });

  tree._criteria = criteria;

  return tree;
}

function buildPersistGraph (model, inputs) {
  const associations = sails.models[model].associations;
  const tree = {
    _model: model,
    _pk: sails.models[model].primaryKey,
    _relations: []
  };

  inputs = Array.isArray(inputs) ? inputs : [inputs];

  inputs.forEach(data => {
    const relations = Object.keys(data).filter(
      key => !/^[0-9]*$/.test(key) && typeof data[key] === 'object'
    );

    relations.forEach(relation => {
      if (tree[relation]) {
        return;
      }

      tree._relations.push(relation);
      tree[relation] = {
        _self: relation,
        _parent: model
      };

      const association = associations.find(assoc => assoc.alias === relation);

      if (association) {
        tree[relation]._model = association.model || association.collection,
        tree[relation]._via = association.via;

        if (association.type === 'model') {
          tree[relation]._type = 'belongsTo';
        } else {
          const relatedAssociation = sails.models[tree[relation]._model]
            .attributes[association.via];

          if (relatedAssociation.model) {
            tree[relation]._type = 'hasMany';
          } else {
            tree[relation]._type = 'manyToMany';
          }
        }

        tree[relation] = {
          ...tree[relation],
          ...buildPersistGraph(tree[relation]._model, data[relation])
        };
      } else if (sails.models[model].attributes[relation]) {
        // Quick fix
        // TODO: find a better way to handle this
        delete tree[relation];
        tree._relations.splice(tree._relations.indexOf(relation), 1);
        return;
      } else {
        // The relation doesn't exist.
        // Mean that a custom action is defined is defined to handle this
        // Eg: for non defined relation "foo" there will be and action createFoo
        const actionName = 'create' + capitalize(relation);
        const relationOptions = sails.models[tree._model].customRelations
          ? sails.models[tree._model].customRelations[relation]
          : null;

        tree[relation]._type = 'custom';

        if (relationOptions) {
          if (relationOptions.type) {
            tree[relation]._custom_type = relationOptions.type;
          }

          if (relationOptions.pk) {
            tree[relation]._pk = relationOptions.pk;
          }

          if (relationOptions.via) {
            tree[relation]._via = relationOptions.via;
          }
        }

        if (!sails.models[tree._model].resource.actions[actionName]) {
          sails.log.warn(`It look like you are trying to persist relation "${relation}"`);
          sails.log.warn(`which is not defined on the model ${capitalize(tree._model)}`);
          sails.log.warn(`There should be a custom action "${actionName}" defined on the model custom actions`);
          sails.log.warn('Skipping this relation...');
        }
      }
    });
  });

  return tree;
}

function normalizeCriteria (tree) {
  const Model = sails.models[tree._model]
  const criteria = tree._criteria || {};
  const normalizedCriteria = {};

  if (criteria.limit) {
    normalizedCriteria.limit = parseInt(criteria.limit);
  } else {
    normalizedCriteria.limit = Model.resource.pagination.limit
  }

  if (criteria.offset) {
    normalizedCriteria.skip = parseInt(criteria.offset);
  }

  if (criteria.sort) {
    normalizedCriteria.sort = Object.keys(criteria.sort)
      .map(key => ({ [key]: criteria.sort[key].toUpperCase() }));
  }

  // Where clauses
  const attributes = Object.keys(Model.attributes);
  const filters = pick(criteria, attributes);
  const where = {};

  Object.keys(filters).forEach(key => {
    if (Array.isArray(filters[key])) {
      where[key] = {
        in: filters[key]
      };
    } else if (typeof filters[key] === 'object') {
      where[key] = Object.keys(filters[key]).reduce((result, op) => {
        result[OPERATORS_MAP[op] || op] = parseValueToPrimitive(filters[key][op]);
        return result;
      }, {});
    } else if (filters[key]) {
      where[key] = parseValueToPrimitive(filters[key]);
    }
  });

  if (criteria.search && Model.resource.searchable ) {
    where.or = Model.resource.searchable.map(field => ({
      [field]: { contains: criteria.search }
    }))
  }

  if (Object.keys(where).length > 0) {
    normalizedCriteria.where = where;
  }

  tree._criteria = normalizedCriteria;

  if (tree._relations && tree._relations.length > 0) {
    tree._relations .forEach(relation => {
      normalizeCriteria(tree[relation]);
    });
  }
}


module.exports = function parseResourceOptions (req) {
  const model = req.options._model;
  const Model = sails.models[model];

  const requestMethod = req.method.toLowerCase();

  if (requestMethod === 'get') {
    let { include: includes = '', limit, sort, ...criteria } = unflatten(req.query);

    includes = Array.isArray(includes) ? includes : includes.split(',');
    includes = parseIncludes(req.query.include, Model);

    injectLimitIntoCriteria(limit, criteria);
    injectSortIntoCriteria(sort, criteria);

    const graph = buildPopulateGraph(model, includes, criteria);

    normalizeCriteria(graph);

    return graph;
  } else {
    // TODO: think about how to generate the tree validation
    // From each model validation object
    // This will prevent us from defining all validation rules
    // in the base model. It will be cool

    return buildPersistGraph(model, req.body);
  }
};
