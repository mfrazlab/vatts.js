/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 */
package main

import "C"
import (
	"compress/gzip"
	"core-go/utils"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/andybalholm/brotli"
	"github.com/evanw/esbuild/pkg/api"
)

//export Optimize
func Optimize(targetDirC *C.char, outputDirC *C.char, ignoredPatternsC *C.char, sslC *C.char) *C.char {
	targetDir := C.GoString(targetDirC)
	outputDir := C.GoString(outputDirC)
	ignoredPatternsStr := C.GoString(ignoredPatternsC)
	ssl := C.GoString(sslC)
	var ignoredList []string
	if ignoredPatternsStr != "" {
		ignoredList = strings.Split(ignoredPatternsStr, ",")
	}

	if outputDir == "" {
		outputDir = filepath.Join(targetDir, "optimized")
	}

	var entryPoints []string

	err := filepath.Walk(targetDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if strings.Contains(path, "node_modules") {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		for _, ignoreItem := range ignoredList {
			cleanIgnore := strings.TrimSpace(ignoreItem)
			if cleanIgnore != "" && strings.Contains(path, cleanIgnore) {
				if info.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
		}

		if info.IsDir() {
			return nil
		}

		if strings.Contains(path, outputDir) || strings.Contains(path, "optimized") {
			return nil
		}

		if strings.HasSuffix(info.Name(), ".js") {
			entryPoints = append(entryPoints, path)
		}
		return nil
	})

	if len(entryPoints) == 0 {
		msg := fmt.Sprintf("No .js files found in: %s", targetDir)
		return C.CString(msg)
	}

	result := api.Build(api.BuildOptions{
		EntryPoints:       entryPoints,
		Outdir:            outputDir,
		Bundle:            true,
		Splitting:         true,
		Format:            api.FormatESModule,
		TreeShaking:       api.TreeShakingTrue,
		MinifyWhitespace:  true,
		MinifyIdentifiers: true,
		MinifySyntax:      true,
		LegalComments:     api.LegalCommentsNone,
		Drop:              api.DropConsole | api.DropDebugger,
		Define: map[string]string{
			"process.env.NODE_ENV":            "\"production\"",
			"import.meta.env.MODE":            "\"production\"",
			"import.meta.env.DEV":             "false",
			"import.meta.env.PROD":            "true",
			"__DEV__":                         "false",
			"__PROD__":                        "true",
			"__VUE_OPTIONS_API__":             "false",
			"__VUE_PROD_DEVTOOLS__":           "false",
			"globalThis.process.env.NODE_ENV": "\"production\"",
		},
		Target: api.ESNext,
		Write:  true,
		External: []string{
			"*.vue", "*.css", "*.woff2", "*.woff", "*.ttf", "*.eot", "*.svg", "*.png", "*.jpg", "*.jpeg", "*.gif",
			"react", "react-dom", "scheduler",
			"vue", "@vue/*",
		},
	})

	if len(result.Errors) > 0 {
		var sb strings.Builder
		sb.WriteString("Error in optimization (esbuild):\n")
		for _, err := range result.Errors {
			line := fmt.Sprintf("%s:%d: %s\n", err.Location.File, err.Location.Line, err.Text)
			sb.WriteString(line)
		}
		return C.CString(sb.String())
	}

	err = filepath.Walk(outputDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".js") {
			if ssl == "true" {
				if err := compressToBrotli(path); err != nil {
					return fmt.Errorf("brotli failure %s: %v", info.Name(), err)
				}
			} else {
				if err := compressToGzip(path); err != nil {
					return fmt.Errorf("gzip failure %s: %v", info.Name(), err)
				}
			}
		
			// Remove original source to save space
			if err := os.Remove(path); err != nil {
				return fmt.Errorf("failed to delete original %s: %v", info.Name(), err)
			}
		}
		return nil
	})

	if err != nil {
		return C.CString(fmt.Sprintf(" Error processing final files: %v", err))
	}

	os.RemoveAll(filepath.Join(outputDir, "chunks"))
	os.RemoveAll(filepath.Join(outputDir, "temp"))

	printTotalStats(entryPoints, outputDir)

	return nil
}

func compressToGzip(srcPath string) error {
	srcFile, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(srcPath + ".gz")
	if err != nil {
		return err
	}
	defer dstFile.Close()

	writer, _ := gzip.NewWriterLevel(dstFile, gzip.BestCompression)
	defer writer.Close()

	_, err = io.Copy(writer, srcFile)
	return err
}

func compressToBrotli(srcPath string) error {
	srcFile, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(srcPath + ".br")
	if err != nil {
		return err
	}
	defer dstFile.Close()

	// Qualidade 11 é a máxima do Brotli (equivalente ao BestCompression)
	writer := brotli.NewWriterLevel(dstFile, brotli.BestCompression)
	defer writer.Close()

	_, err = io.Copy(writer, srcFile)
	return err
}

func printTotalStats(entries []string, outDir string) {
	var totalOrig, totalGzip, totalBr int64

	for _, f := range entries {
		if info, err := os.Stat(f); err == nil {
			totalOrig += info.Size()
		}
	}

	filepath.Walk(outDir, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			if strings.HasSuffix(info.Name(), ".gz") {
				totalGzip += info.Size()
			} else if strings.HasSuffix(info.Name(), ".br") {
				totalBr += info.Size()
			}
		}
		return nil
	})

	if totalOrig > 0 {
		// Consideramos a maior economia (geralmente Brotli)
		bestFinal := totalBr
		if totalGzip < totalBr && totalGzip > 0 {
			bestFinal = totalGzip
		}

		diff := totalOrig - bestFinal
		pct := (float64(diff) / float64(totalOrig)) * 100

		original := fmt.Sprintf("  Original : %s%.2f KB", utils.Bright+utils.FgGreen, float64(totalOrig)/1024)
		brotliStr := fmt.Sprintf("  Final    : %s%.2f KB", utils.Bright+utils.FgGreen, float64(totalBr)/1024)
		saved := fmt.Sprintf("  Saved    : %s%.2f KB %s(%.2f%%)%s", utils.Bright+utils.FgGreen, float64(diff)/1024, utils.Reset+utils.FgGray, pct, utils.Reset)

		utils.LogCustomLevel("", false, "", "", utils.FgBlue+utils.Bright+"Optimization summary:"+utils.Reset,
			original, brotliStr, saved, "Optimizer")
	}
}
