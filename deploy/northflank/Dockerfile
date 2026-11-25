FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=10000 BIND_HOST=0.0.0.0
COPY --chown=node:node server/ ./server/
COPY --chown=node:node config.js match-plans.js shotgun-pellets.js shooting-spread.js melee-rules.js ./
USER node
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server/server.js"]
