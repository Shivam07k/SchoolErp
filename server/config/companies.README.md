/* ============================================================
   Company (database) connections - the ONE file you edit.

   server/config/companies.json holds every company. Adding one is a
   one-line edit here; nothing else in the codebase needs to change.

   MINIMUM - same server, database name matches the id:

       { "id": "ash1", "label": "Ash1" }

   host / port / user / password fall back to PG_HOST / PG_PORT / PG_USER /
   PG_PASSWORD in server/.env, and "database" falls back to the id.

   DIFFERENT SERVER - just add the connection, that is the whole setup:

       {
         "id": "mumbai",
         "label": "Mumbai Branch",
         "host": "10.0.0.5",
         "port": 5432,
         "user": "erp_read",
         "passwordEnv": "MUMBAI_DB_PASSWORD",
         "database": "mumbai_ho"
       }

   KEYS
     id           required. Folder name in src/companies/<id>/ and the login id.
     label        shown on the login screen. Optional - falls back to the
                  database's own fn_companyname(), then to the id.
     database     target database name. Defaults to the id.
     host, port   target server. Default: PG_HOST / PG_PORT.
     user         role to connect as. Default: PG_USER.
     password     literal password. Prefer passwordEnv.
     passwordEnv  name of an environment variable holding the password, so
                  secrets stay out of this file.
     url          full connection string, overrides the fields above.
     ssl          true, or { "rejectUnauthorized": false } for a remote server.
     max          pool size for this company. Default: PG_MAX.

   "default" is the company used when a request carries no company id.

   Adding or editing a company takes effect immediately - the file is watched
   by mtime, so there is no restart and no redeploy.
   ============================================================ */
