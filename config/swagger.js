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
    tags: [
      {
        name: 'Teams',
        description: 'Tournament teams stored in the oppem database',
      },
      {
        name: 'Games',
        description: 'Matches in the oppem database',
      },
      {
        name: 'Tournament',
        description: 'Tournament schedule, setup, and reset',
      },
    ],
    components: {
      schemas: {
        Team: {
          type: 'object',
          required: ['id', 'name', 'group'],
          properties: {
            id: { type: 'string', description: 'Stable team identifier' },
            name: { type: 'string' },
            group: { type: 'string', description: 'Group label or key' },
          },
        },
        TeamInput: {
          type: 'object',
          required: ['id', 'name', 'group'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            group: { type: 'string' },
          },
        },
        TeamsDeleteAllResponse: {
          type: 'object',
          required: ['deletedCount'],
          properties: {
            deletedCount: { type: 'integer', description: 'Teams removed' },
          },
        },
        Game: {
          type: 'object',
          description:
            'Both `homeTeam` and `awayTeam` are set together, or both are null (placeholder / TBD match).',
          required: ['id', 'round', 'order', 'startHour', 'endHour'],
          properties: {
            id: { type: 'string' },
            homeTeam: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/Team' }],
              description: 'Null when the opponent is not yet known.',
            },
            awayTeam: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/Team' }],
              description: 'Null when the opponent is not yet known.',
            },
            homeTeamScore: { type: 'number', nullable: true },
            awayTeamScore: { type: 'number', nullable: true },
            penaltyHomeTeamScore: { type: 'number', nullable: true },
            penaltyAwayTeamScore: { type: 'number', nullable: true },
            round: {
              type: 'string',
              description:
                'Phase label. Poule: `"group A"` / `"group B"` from POST /api/tournament. Knockout placeholders: `"lastPlace"`, `"quarterFinal"`, `"semiFinal"`, `"final"`.',
              example: 'group A',
            },
            order: { type: 'number' },
            startHour: { type: 'string' },
            endHour: { type: 'string' },
            terrain: {
              type: 'string',
              nullable: true,
              description: 'Pitch / field label (optional).',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Free-text notes for the match (optional).',
            },
          },
        },
        GameCreate: {
          type: 'object',
          description:
            'Provide both team ids or omit both / null (placeholder). Mixed state is invalid.',
          required: ['id', 'round', 'order', 'startHour', 'endHour'],
          properties: {
            id: { type: 'string' },
            homeTeam: { type: 'string', nullable: true },
            awayTeam: { type: 'string', nullable: true },
            homeTeamScore: { type: 'number', nullable: true },
            awayTeamScore: { type: 'number', nullable: true },
            penaltyHomeTeamScore: { type: 'number', nullable: true },
            penaltyAwayTeamScore: { type: 'number', nullable: true },
            round: {
              type: 'string',
              description:
                'Non-empty string. Poule: `"group A"` / `"group B"`. Knockout placeholders from tournament create: `lastPlace`, `quarterFinal`, `semiFinal`, `final`.',
              example: 'group A',
            },
            order: { type: 'number' },
            startHour: { type: 'string' },
            endHour: { type: 'string' },
            terrain: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
          },
        },
        TournamentGroups: {
          type: 'object',
          required: ['a', 'b'],
          properties: {
            a: {
              type: 'array',
              items: { $ref: '#/components/schemas/Game' },
            },
            b: {
              type: 'array',
              items: { $ref: '#/components/schemas/Game' },
            },
          },
        },
        TournamentSingleGameSlot: {
          oneOf: [
            { $ref: '#/components/schemas/Game' },
            {
              type: 'object',
              description:
                'Empty object only if no matching game exists (e.g. legacy data before knockout placeholders).',
              additionalProperties: true,
            },
          ],
        },
        TournamentStandingRow: {
          type: 'object',
          required: [
            'rank',
            'team',
            'played',
            'wins',
            'draws',
            'losses',
            'points',
            'goalsFor',
            'goalsAgainst',
            'goalDifference',
          ],
          properties: {
            rank: { type: 'integer' },
            team: { $ref: '#/components/schemas/Team' },
            played: { type: 'integer' },
            wins: { type: 'integer' },
            draws: { type: 'integer' },
            losses: { type: 'integer' },
            points: {
              type: 'integer',
              description: '3 for a win, 1 for a draw, 0 for a loss (full time only)',
            },
            goalsFor: { type: 'integer' },
            goalsAgainst: { type: 'integer' },
            goalDifference: { type: 'integer' },
          },
        },
        TournamentStandings: {
          type: 'object',
          required: ['a', 'b'],
          description:
            'Ordered by points (3-1-0 from full time), then goal difference, then head-to-head penalty winner if both shootout scores exist',
          properties: {
            a: {
              type: 'array',
              items: { $ref: '#/components/schemas/TournamentStandingRow' },
            },
            b: {
              type: 'array',
              items: { $ref: '#/components/schemas/TournamentStandingRow' },
            },
          },
        },
        TournamentGetResponse: {
          type: 'object',
          required: [
            'groups',
            'standings',
            'lastPlace',
            'quarterFinal',
            'semiFinal',
            'final',
          ],
          properties: {
            groups: { $ref: '#/components/schemas/TournamentGroups' },
            standings: { $ref: '#/components/schemas/TournamentStandings' },
            lastPlace: {
              $ref: '#/components/schemas/TournamentSingleGameSlot',
            },
            quarterFinal: {
              type: 'array',
              items: { $ref: '#/components/schemas/Game' },
            },
            semiFinal: {
              type: 'array',
              items: { $ref: '#/components/schemas/Game' },
            },
            final: { $ref: '#/components/schemas/TournamentSingleGameSlot' },
          },
        },
        TournamentReorderRequest: {
          type: 'object',
          required: ['groups'],
          properties: {
            groups: {
              type: 'object',
              required: ['a', 'b'],
              properties: {
                a: {
                  type: 'array',
                  minItems: 10,
                  maxItems: 10,
                  items: { type: 'string' },
                  description:
                    'Group A (`round` group A) game ids, display order top to bottom',
                },
                b: {
                  type: 'array',
                  minItems: 10,
                  maxItems: 10,
                  items: { type: 'string' },
                  description:
                    'Group B (`round` group B) game ids, display order top to bottom',
                },
              },
            },
          },
        },
        TournamentCreateResponse: {
          type: 'object',
          required: [
            'gamesCreated',
            'groups',
            'standings',
            'lastPlace',
            'quarterFinal',
            'semiFinal',
            'final',
          ],
          properties: {
            gamesCreated: {
              type: 'integer',
              example: 28,
              description:
                '20 group-stage matches plus 8 knockout placeholders (last place, 4× quarter, 2× semi, final).',
            },
            groups: { $ref: '#/components/schemas/TournamentGroups' },
            standings: { $ref: '#/components/schemas/TournamentStandings' },
            lastPlace: {
              $ref: '#/components/schemas/TournamentSingleGameSlot',
            },
            quarterFinal: {
              type: 'array',
              items: { $ref: '#/components/schemas/Game' },
            },
            semiFinal: {
              type: 'array',
              items: { $ref: '#/components/schemas/Game' },
            },
            final: { $ref: '#/components/schemas/TournamentSingleGameSlot' },
          },
        },
        TournamentResetResponse: {
          type: 'object',
          required: ['deletedCount'],
          properties: {
            deletedCount: { type: 'integer' },
          },
        },
        GameUpdate: {
          type: 'object',
          properties: {
            homeTeam: {
              type: 'string',
              nullable: true,
              description: 'Set to null to clear; must stay paired with awayTeam.',
            },
            awayTeam: {
              type: 'string',
              nullable: true,
              description: 'Set to null to clear; must stay paired with homeTeam.',
            },
            homeTeamScore: { type: 'number', nullable: true },
            awayTeamScore: { type: 'number', nullable: true },
            penaltyHomeTeamScore: { type: 'number', nullable: true },
            penaltyAwayTeamScore: { type: 'number', nullable: true },
            round: {
              type: 'string',
              description: 'Updated poule/phase label (non-empty string).',
              example: 'group B',
            },
            order: { type: 'number' },
            startHour: { type: 'string' },
            endHour: { type: 'string' },
            terrain: {
              type: 'string',
              nullable: true,
              description: 'Clear with null or empty string.',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Clear with null or empty string.',
            },
          },
        },
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