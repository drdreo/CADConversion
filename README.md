# ThieleConversion - Auth0 Angular

# App
## Development server

Run `npm run dev` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

This will automatically start a Node + Express server as the backend on port `3001`. The Angular application is configured to proxy through to this on any `/api` route.

## Build

Run `npm build` to build the project. The build artifacts will be stored in the `dist/login-demo` directory. Use the `--prod` flag for a production build.

To build and run a production bundle and serve it, run `npm run prod`. The application will run on `http://localhost:3000`.

## Run Using Docker

You can build and run the sample in a Docker container by using the provided scripts:

```bash
# In Linux / MacOS
sh exec.sh

# Windows Powershell
./exec.ps1
```

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).


# Server

## Static Server

Run `npm run server:app` for the node server that serves the frontend app.


## API Server

Run `npm run server:api` for the node server that serves the API for the app.
