package logger

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"
)

type Level string

const (
	DEBUG Level = "DEBUG"
	INFO  Level = "INFO"
	WARN  Level = "WARN"
	ERROR Level = "ERROR"
)

type Logger struct {
	level Level
}

type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
}

var std = New(INFO)

func New(level Level) *Logger {
	return &Logger{level: level}
}

func (l *Logger) log(level Level, message string, fields map[string]interface{}) {
	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Level:     string(level),
		Message:   message,
		Fields:    fields,
	}

	jsonBytes, err := json.Marshal(entry)
	if err != nil {
		log.Printf("Error marshaling log entry: %v", err)
		return
	}

	fmt.Fprintln(os.Stdout, string(jsonBytes))
}

func (l *Logger) Debug(message string, fields ...map[string]interface{}) {
	if l.level == DEBUG {
		f := mergeFields(fields...)
		l.log(DEBUG, message, f)
	}
}

func (l *Logger) Info(message string, fields ...map[string]interface{}) {
	f := mergeFields(fields...)
	l.log(INFO, message, f)
}

func (l *Logger) Warn(message string, fields ...map[string]interface{}) {
	f := mergeFields(fields...)
	l.log(WARN, message, f)
}

func (l *Logger) Error(message string, fields ...map[string]interface{}) {
	f := mergeFields(fields...)
	l.log(ERROR, message, f)
}

func mergeFields(fields ...map[string]interface{}) map[string]interface{} {
	merged := make(map[string]interface{})
	for _, f := range fields {
		for k, v := range f {
			merged[k] = v
		}
	}
	return merged
}

// Package-level convenience functions
func Debug(message string, fields ...map[string]interface{}) {
	std.Debug(message, fields...)
}

func Info(message string, fields ...map[string]interface{}) {
	std.Info(message, fields...)
}

func Warn(message string, fields ...map[string]interface{}) {
	std.Warn(message, fields...)
}

func Error(message string, fields ...map[string]interface{}) {
	std.Error(message, fields...)
}
