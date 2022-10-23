export default class SurveyStep {
    constructor(next, prev) {
        this.next = next
        this.prev = prev
    }
    incoming = msg => console.log(msg)
    message = 'hello world'
    reactions = [ '✅' = () => this.next() ]
}
