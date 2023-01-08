import { Component, EventEmitter, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of, map, Observable, switchMap, filter, distinctUntilChanged, debounceTime, tap, merge, Subject, Subscription } from 'rxjs';
import { Word } from './search.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'my-app';
  lookupResults : Word[] = [];

  onLookup(words : Word[]) {
    console.log("received message");
    this.lookupResults = words;
  }
}
