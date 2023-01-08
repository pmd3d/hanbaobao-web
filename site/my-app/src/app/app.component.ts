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
  delayedWords : Observable<Word[]>;
  immediateWords : Observable<Word[]>;
  userModelWord : String = "";
  words : Observable<Word[]>;
  words2 : Word[] = [];
  requesting : boolean = false;
  readonly defaultDelay : number = 1000;
  templateConductor : Subject<string>;

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
          .get<Word[]>("api/search?myquery=" + word)
      }),
      tap((word) => { 
        this.requesting = false;
      })       
    );
    this.words = merge(this.immediateWords, this.delayedWords);

    this.templateConductor = new Subject();
    this.templateConductor.pipe(
      filter((word, index) => { return word !== null; }),
      map(word => word?.trim()),
      filter((word, index) => { return word !== ""; }),
      debounceTime(this.defaultDelay),
      distinctUntilChanged())
      .subscribe((word : string) => {
        this.http.get<Word[]>("api/search?myquery=" + word)
        .subscribe(wordArray => { this.words2 = wordArray; })
      }
      );
  }

  getSomething() {
    if (this.userText.value?.trim() !== "")
      this.immediateWords = this.http
        .get<Word[]>("api/search?myquery=" + this.userText.value);
  }

  getSomething2(word : string) {
    if (word?.trim() !== "")
      this.http
        .get<Word[]>("api/search?myquery=" + word)
        .subscribe(wordArray => { this.words2 = wordArray; });
  }

  onKey(event: any) {
    const word : string = event.target.value;
    this.templateConductor.next(word);
    console.log("pushing " + word);
  }

  ngOnDestroy() {
    console.log("cleaning up");
    this.templateConductor.unsubscribe();
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

