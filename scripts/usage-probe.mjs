import { mutate, MUTATOR_KEYWORDS } from "schemafuzz";
console.log(MUTATOR_KEYWORDS.length);
console.log(mutate({type:"string",minLength:3}, "abcdef").mutants.length);
