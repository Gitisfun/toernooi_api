import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Toernooi API',
      version: '1.0.0',
      description: 'API documentation for toernooi',
    },
    servers: [
      {
        url: '/api',
        description: 'API server',
      },
    ],
    components: {
      schemas: {
        BadRequestError: {
          type: 'object',
          properties: {
            code: {
              type: 'integer',
              example: 400,
            },
            message: {
              type: 'string',
              example: 'Bad request',
            },
          },
        },
        NotFoundError: {
          type: 'object',
          properties: {
            code: {
              type: 'integer',
              example: 404,
            },
            message: {
              type: 'string',
              example: 'Resource not found',
            },
          },
        },
        InternalError: {
          type: 'object',
          properties: {
            code: {
              type: 'integer',
              example: 500,
            },
            message: {
              type: 'string',
              example: 'Internal server error',
            },
          },
        },
      },
    },
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;