import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of, map, Observable, switchMap, filter, distinctUntilChanged, debounceTime, tap, merge } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'my-app';
  userText = new FormControl("");
  delayedWords : Observable<Word[]>;
  immediateWords : Observable<Word[]>;
  words : Observable<Word[]>;
  requesting : boolean = false;
  readonly defaultDelay : number = 1000;

  constructor(private http : HttpClient) {
    this.immediateWords = of([]); 
    this.delayedWords = this.userText.valueChanges.pipe(
      filter((word, index) => { return word !== null; }),
      map(word => word?.trim()),
      filter((word, index) => { return word !== ""; }),
      debounceTime(this.defaultDelay),
      distinctUntilChanged(),
      switchMap((word, index) => {
        this.requesting = true;
        return this.http
          .get<Word[]>("api/search?query=" + word)
      }),
      tap((word) => { 
        this.requesting = false;
      }) 
    );
    this.words = merge(this.immediateWords, this.delayedWords);
  }

  getSomething() {
    if (this.userText.value?.trim() !== "")
      this.immediateWords = this.http
        .get<Word[]>("api/search?query=" + this.userText.value);
  }

  ngOnDestroy() {
    console.log("cleaning up");
  }
}

export interface Word {
  id: number;
  simplified: string;
  traditional: string;
  pinyin: string;
  definition: string;
  classifier: string;
  concept: string;
  hskLevel: number;
  topic: string;
  parentTopic: string;
  notes: string;
  frequency: number;
  partOfSpeech: string[]
}

