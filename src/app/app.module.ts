import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AuthHttpInterceptor, AuthModule } from '@auth0/auth0-angular';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { environment as env } from '../environments/environment';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FooterComponent } from './components/footer/footer.component';
import { LoadingComponent } from './components/loading/loading.component';
import { NavBarComponent } from './components/nav-bar/nav-bar.component';
import { ErrorComponent } from './pages/error/error.component';
import { HomeContentComponent } from './pages/home/home-content/home-content.component';
import { HomeComponent } from './pages/home/home.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { FilesComponent } from './pages/files/files.component';
import { FileUploadModule } from '@iplab/ngx-file-upload';

@NgModule({
	declarations: [
		AppComponent,
		HomeComponent,
		ProfileComponent,
		NavBarComponent,
		FooterComponent,
		HomeContentComponent,
		LoadingComponent,
		ErrorComponent,
		FilesComponent
	],
	imports: [
		BrowserModule,
		AppRoutingModule,
		HttpClientModule,
		NgbModule,
		FontAwesomeModule,
		AuthModule.forRoot({
			...env.auth,
			httpInterceptor: {
				...env.httpInterceptor
			}
		}),
		FileUploadModule,
		BrowserAnimationsModule
	],
	providers: [
		{
			provide: HTTP_INTERCEPTORS,
			useClass: AuthHttpInterceptor,
			multi: true
		},
		{
			provide: Window,
			useValue: window
		},
	],
	bootstrap: [AppComponent]
})
export class AppModule {}
