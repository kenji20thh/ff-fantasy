package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/", func (w http.ResponseWriter, r*http.Request) {)  {
		fmt.Println(w, "FF fantasy")
	})
	fmt.Println("server running on http://localhost:8080")
}
