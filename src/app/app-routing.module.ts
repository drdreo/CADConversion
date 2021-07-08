import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AuthGuard } from '@auth0/auth0-angular';
import { ErrorComponent } from './pages/error/error.component';
import { FilesComponent } from './pages/files/files.component';
import { HomeComponent } from './pages/home/home.component';
import { ProfileComponent } from './pages/profile/profile.component';

const routes: Routes = [
	{
		path: 'profile',
		component: ProfileComponent,
		canActivate: [AuthGuard]
	},
	{
		path: 'files',
		component: FilesComponent,
		canActivate: [AuthGuard]
	},
	{
		path: 'error',
		component: ErrorComponent
	},
	{
		path: '',
		component: HomeComponent,
		pathMatch: 'full'
	},
	{ path: '**', redirectTo: '', pathMatch: 'full' }
];

@NgModule({
	imports: [RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' })],
	exports: [RouterModule]
})
export class AppRoutingModule {}
