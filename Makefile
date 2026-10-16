# Makefile for the ADOC reproduction.
# Requires a C++14 compiler (tested with g++ 6.3.0 / MinGW on Windows).

CXX      ?= g++
CXXFLAGS ?= -std=c++14 -O2 -Wall -Wextra

OBJ = adoc_tuner.o metrics_collector.o stall_listener.o workload.o main.o

all: adoc

adoc_tuner.o:        adoc_tuner.cpp adoc_tuner.h
	$(CXX) $(CXXFLAGS) -c adoc_tuner.cpp -o adoc_tuner.o
metrics_collector.o: metrics_collector.cpp metrics_collector.h adoc_tuner.h
	$(CXX) $(CXXFLAGS) -c metrics_collector.cpp -o metrics_collector.o
stall_listener.o:    stall_listener.cpp stall_listener.h adoc_tuner.h
	$(CXX) $(CXXFLAGS) -c stall_listener.cpp -o stall_listener.o
workload.o:          workload.cpp workload.h
	$(CXX) $(CXXFLAGS) -c workload.cpp -o workload.o
main.o:              main.cpp adoc_tuner.h metrics_collector.h stall_listener.h workload.h
	$(CXX) $(CXXFLAGS) -c main.cpp -o main.o

adoc: $(OBJ)
	$(CXX) $(CXXFLAGS) $(OBJ) -o adoc

test: adoc
	./adoc --test

run: adoc
	./adoc

clean:
	rm -f $(OBJ) adoc adoc.exe

.PHONY: all test run clean
