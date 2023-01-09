import { HttpClient } from "@angular/common/http";
import { Pipe, PipeTransform } from "@angular/core";
import { of, map, Observable, switchMap, filter, distinctUntilChanged, debounceTime, tap, merge, Subject, Subscription } from 'rxjs';
import { Word } from "./search.component";

@Pipe({
    name: 'getPipe',
    pure: true
})
export class GetWordPipe implements PipeTransform {
    pipeline : Subject<string>;
    words : Observable<Word[]>;

    constructor(private http: HttpClient) {
        this.pipeline = new Subject<string>();
        this.words = this.pipeline.pipe(
            filter((word, index) => { return word !== null; }),
            map(word => word.trim()),
            filter((word, index) => { return word !== ""; }),
            debounceTime(1000),
            distinctUntilChanged(),
            switchMap((word, index) => {
                return this.http.get<Word[]>("api/search?myquery=" + word);
            }));

    }

    transform(word : string) : Observable<Word[]> {
        console.log("transforming " + word);
        this.pipeline.next(word);
        return this.words;
    }
}