import { Component, OnInit } from '@angular/core';
import { faLink, faUser, faExchangeAlt } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-home-content',
  templateUrl: './home-content.component.html',
  styleUrls: ['./home-content.component.css']
})
export class HomeContentComponent implements OnInit {
  faLink = faLink;
  faLogin = faUser;
  faConvert = faExchangeAlt;

  constructor() { }

  ngOnInit() {
  }

}
