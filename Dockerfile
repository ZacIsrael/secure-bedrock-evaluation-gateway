ARG NODE_IMAGE

# Install locked dependencies and compile the TypeScript application.
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
# Stage the versioned prompts for the runtime image.
COPY eval/prompts ./eval/prompts
RUN npm run build

# Run the compiled application with the same pinned Node.js image.
FROM ${NODE_IMAGE}
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Make the frozen prompt available to the running gateway.
COPY --from=build /app/eval/prompts ./eval/prompts