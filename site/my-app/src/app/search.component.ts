import { HttpClient } from "@angular/common/http";
import { Component, EventEmitter, Output } from "@angular/core";
import { FormControl } from "@angular/forms";
import { debounceTime, distinctUntilChanged, filter, map, Subject, Subscription, switchMap } from "rxjs";

@Component({
    selector: 'search',
    template: '<label for=\"userText">English word:</label><input id="userText" [formControl]="userText" (keyDown.Enter)="lookup()"><button (click)="lookup()">Lookup</button>',
    styleUrls: ['./app.component.css']
})
export class SearchComponent
{
    userText = new FormControl("");
    @Output() words : EventEmitter<Word[]>;
    readonly defaultDelay : number = 1000;
    charChangesSubscription : Subscription;
    senderSubscription : Subscription;
    commonPipe : Subject<string>;
  
    constructor(private http : HttpClient) {
        this.words = new EventEmitter(); 
        this.commonPipe = new Subject();
        const sender = this.commonPipe.pipe(
            filter((word, index) => { return word !== null; }),
            map(word => word?.trim()),
            filter((word, index) => { return word !== ""; }),
            debounceTime(this.defaultDelay),
            distinctUntilChanged(),
            switchMap((word, index) => {
                return this.http.get<Word[]>("api/search?myquery=" + word);
            }));

        this.charChangesSubscription = this.userText.valueChanges.subscribe((word) => { if (word !== null) this.commonPipe.next(word); });
        this.senderSubscription = sender.subscribe((words : Word[]) => { this.words.emit(words); });
    }
  
    lookup() {
        const word = this.userText.value?.trim();
        if (word !== undefined)
        {
            console.log("piping word " + word);
            this.commonPipe.next(word); 
        }
    }
  
    ngOnDestroy() {
      this.charChangesSubscription.unsubscribe();
      this.senderSubscription.unsubscribe();
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
  
  