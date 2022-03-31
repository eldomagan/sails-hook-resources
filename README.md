# Sails Hook Resources

This package take inspiration from Laravel ecosystem tools (Models, Policies, Validation, Transformer) to provide an extensible REST interface and more to your Waterline models

All you have to do is to define your models and make theme "resourceable" and let this package do the REST for you! All endpoints for index, search, show, store, update, destroy, restore operations will already be there with proper validation and error handling.

# Features

- REST API for models and relationships with batch operations support
- Advanced searching capabilities with sorting, filtering, and keyword search
- Comprehensive set of endpoint hooks
- Relations inclusion and soft deletes via query parameters
- Straightforward inputs validation
- Responses transformation via API resources


# Installation

Sails hook Resources can be installed into a new or existing project simply by installing this npm package:

```shell
npm install --save sails-hook-resources
```

```shell
# For yarn users
yarn add sails-hook-resources
```

# Simple CRUD

Let's assume you have a model Post that represents a blog post and you would like to manage it via REST API.

Just add this to your model to get a CRUD REST API:

```diff
module.exports = {
  attributes: {
    title: 'string',
    content: 'string'
  },

+ resource: true
}
```

Done 🎉 Now you can create, list, search, view, update, and delete blog posts via REST API. Try to create a post via (POST) https://<your app url>/posts endpoint 😉

| Method  | Endpoint | Description |
| ------------- | ------------- | - |
| GET, HEAD  | /posts  | List all posts |
| POST  | /posts  | Create new post |
| GET | /posts/:id | Get a post by id |
| PUT, PATCH | /posts/:id | Update a post |
| DELETE | /posts/:id | Delete a post |

## Customizing api path

```diff
module.exports = {
  attributes: {
    title: 'string',
    content: 'string'
  },

- resource: true
+ resource: {
+   path: 'custom-posts'
+ }
}
```
With that, your post API will be available here https://<your app url>/custom-posts
