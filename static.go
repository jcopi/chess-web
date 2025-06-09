package main

import (
	"embed"
	"io/fs"
)

//go:embed dist
var resources embed.FS
var Resources fs.FS

func init() {
	var err error
	Resources, err = fs.Sub(resources, "dist")
	if err != nil {
		panic(err)
	}
}
