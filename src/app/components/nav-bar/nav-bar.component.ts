import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { faUser, faPowerOff , faFile} from '@fortawesome/free-solid-svg-icons';

@Component({
	selector: 'app-nav-bar',
	templateUrl: './nav-bar.component.html',
	styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent implements OnInit {
	isCollapsed = true;
	faUser = faUser;
	faFile = faFile;
	faPowerOff = faPowerOff;

	constructor(
		public auth: AuthService,
		@Inject(DOCUMENT) private doc: Document
	) {}

	ngOnInit() {}

	loginWithRedirect() {
		this.auth.loginWithRedirect();
	}

	logout() {
		this.auth.logout({ returnTo: this.doc.location.origin });
	}
}
