import * as uuid from "uuid";
import { ApolloError } from "apollo-server";
import gql from "graphql-tag";
import { apiVersion } from "@betaflight/api";
import { Resolvers } from "../__generated__";

const typeDefs = gql`
  type Subscription {
    onClosed(connection: ID!): ID!
  }

  type Mutation {
    connect(port: String!, baudRate: Int!): ConnectionDetails!
    close(connection: ID!): ID!
  }

  type Query {
    connectionStats(connection: ID!): ConnectionStats!
  }

  type ConnectionDetails {
    id: ID!
    apiVersion: String!
  }

  type ConnectionStats {
    bytesRead: Int!
    bytesWritten: Int!
    packetErrors: Int!
  }
`;

const resolvers: Resolvers = {
  Subscription: {
    onClosed: {
      subscribe: (_, { connection }, { connections }) => {
        if (!connections.getPort(connection)) {
          throw new ApolloError("Connection is not open");
        }
        return connections.onClosed(connection);
      },
      resolve: (connectionId: string) => connectionId,
    },
  },

  Mutation: {
    connect: (_, { port, baudRate }, { connections, api }) =>
      connections
        .connectLock(port, async () => {
          if (!api.isOpen(port)) {
            try {
              await api.open(port, { baudRate }, () => {
                // remove any connections if the port closes
                connections.remove(port);
              });
            } catch (e) {
              throw new ApolloError(
                `Could not open connection to ${port}: ${e.message}`
              );
            }
          }
        })
        .then(() => {
          // Close any existing connections
          connections.remove(port);

          // start a new connection with a new connection id
          const connectionId = uuid.v4();
          connections.add(port, connectionId);

          return {
            id: connectionId,
            apiVersion: apiVersion(port),
          };
        }),

    close: async (_, { connection }, { connections, api }) => {
      const port = connections.getPort(connection);
      if (!port) {
        throw new ApolloError(`${connection} is not a valid connection`);
      }

      await api.close(port);
      connections.remove(port);
      return connection;
    },
  },

  Query: {
    connectionStats: (_, { connection }, { connections }) => {
      const port = connections.getPort(connection);

      if (!port) {
        throw new ApolloError("Connection is not active");
      }
      return { __typename: "ConnectionStats", port };
    },
  },
  ConnectionStats: {
    bytesRead: ({ port }, _, { api }) => api.bytesRead(port),
    bytesWritten: ({ port }, _, { api }) => api.bytesWritten(port),
    packetErrors: ({ port }, _, { api }) => api.packetErrors(port),
  },
};

export default { resolvers, typeDefs };
