import { Component, EventEmitter } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { of, map, Observable, switchMap, filter, distinctUntilChanged, debounceTime, tap, merge, Subject } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'my-app';
  userText = new FormControl("");
  immediateWords : Observable<Word[]>;
  userModelWord : String = "";
  words : Observable<Word[]>;
  words2 : Observable<Word[]>;
  requesting : boolean = false;
  readonly defaultDelay : number = 1000;
  templateConductor : Subject<string>;

  constructor(private http : HttpClient) {
    this.immediateWords = of([]); 

    this.templateConductor = new Subject();
    this.words2 = this.templateConductor.pipe(
      filter((word, index) => { return word !== null; }),
      map(word => word?.trim()),
      filter((word, index) => { return word !== ""; }),
      debounceTime(this.defaultDelay),
      distinctUntilChanged(),
      switchMap((word, index) => {
        this.requesting = true;
        return this.http.get<Word[]>("api/search?myquery=" + word);
      }),
      tap((word) => { 
        this.requesting = false;
      }));

    this.words = merge(this.immediateWords, this.words2);

    this.userText.valueChanges.subscribe((word) => { if (word !== null) this.templateConductor.next(word); });
  }

  getSomething() {
    if (this.userText.value?.trim() !== "")
      this.immediateWords = this.http
        .get<Word[]>("api/search?myquery=" + this.userText.value);
  }

  // getSomething2(word : string) {
  //   if (word?.trim() !== "")
  //     this.words2 = this.http
  //       .get<Word[]>("api/search?myquery=" + word);
  // }

  // onKey(event: any) {
  //   const word : string = event.target.value;
  //   this.templateConductor.next(word);
  //   console.log("pushing " + word);
  // }

  // ngOnDestroy() {
  //   console.log("cleaning up");
  // }
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

