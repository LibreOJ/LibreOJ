#!/bin/bash

set -euo pipefail

MODE="${1:?Pass build or stage}"
if [[ "$MODE" != build && "$MODE" != stage ]]; then
    echo "Pass build or stage" >&2
    exit 1
fi

WORKING_DIRECTORY="$(mktemp -d)"
trap 'rm -rf "$WORKING_DIRECTORY"' EXIT
cd "$WORKING_DIRECTORY"

export HOME=/tmp
export DOTNET_CLI_HOME=/tmp/dotnet
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_NOLOGO=1
export DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1

expect_output() {
    local expected="$1"
    shift
    local actual
    actual="$("$@")"
    if [[ "$actual" != "$expected" ]]; then
        echo "Expected '$expected', got '$actual' from: $*" >&2
        exit 1
    fi
}

expect_version() {
    local expected="$1"
    shift
    local actual
    actual="$("$@" 2>&1)"
    if [[ "$actual" != *"$expected"* ]]; then
        echo "Expected version containing '$expected', got '$actual' from: $*" >&2
        exit 1
    fi
}

expect_version 14.2 gcc -dumpfullversion
expect_version 14.2 g++ -dumpfullversion
expect_version 20.1 clang --version
expect_version 20.1 clang++ --version
expect_version 21 javac -version
expect_version 1.9.25 kotlinc -version
expect_version 3.2.2 fpc -iV
expect_version 2.7.18 python2.7 --version
expect_version 3.9.25 python3.9 --version
expect_version 3.10.20 python3.10 --version
expect_version 1.97.0 rustc --version
expect_version 6.3.3 swiftc --version
expect_version 1.26.5 go version
expect_version 9.4.7 ghc --version
expect_version 10.0.109 dotnet --version
expect_version 6.8 mono --version

cat > main.c <<'EOF'
#include <stdio.h>
int main(void) { puts("OK"); }
EOF

for compiler in gcc clang; do
    for standard in c89 c99 c11 c17 c23 gnu89 gnu99 gnu11 gnu17 gnu23; do
        "$compiler" -std="$standard" -O2 -m64 main.c -o "c-$compiler-$standard"
    done
    for optimize in 0 1 2 3 fast; do
        "$compiler" -std=c23 "-O$optimize" -m64 main.c -o "c-$compiler-O$optimize"
    done
    "$compiler" -std=c17 -O2 -m32 main.c -o "c-$compiler-32"
    "$compiler" -std=c17 -O2 -mx32 main.c -o "c-$compiler-x32"
    expect_output OK "./c-$compiler-c17"
    expect_output OK "./c-$compiler-32"
    if [[ "$MODE" == stage ]]; then
        expect_output OK "./c-$compiler-x32"
    fi
done

cat > main.cpp <<'EOF'
#include <iostream>
int main() { std::cout << "OK\n"; }
EOF

for compiler in g++ clang++; do
    extra=()
    if [[ "$compiler" == clang++ ]]; then
        extra=(-stdlib=libc++)
    fi
    for standard in c++03 c++11 c++14 c++17 c++20 c++23 c++26 gnu++03 gnu++11 gnu++14 gnu++17 gnu++20 gnu++23 gnu++26; do
        "$compiler" -std="$standard" -O2 -m64 "${extra[@]}" main.cpp -o "cpp-${compiler/+/p}-$standard"
    done
    for optimize in 0 1 2 3 fast; do
        "$compiler" -std=c++26 "-O$optimize" -m64 "${extra[@]}" main.cpp -o "cpp-${compiler/+/p}-O$optimize"
    done
    "$compiler" -std=c++20 -O2 -m32 main.cpp -o "cpp-${compiler/+/p}-32"
    "$compiler" -std=c++20 -O2 -mx32 main.cpp -o "cpp-${compiler/+/p}-x32"
    expect_output OK "./cpp-${compiler/+/p}-c++20"
    expect_output OK "./cpp-${compiler/+/p}-32"
    if [[ "$MODE" == stage ]]; then
        expect_output OK "./cpp-${compiler/+/p}-x32"
    fi
done

cat > Main.java <<'EOF'
public class Main { public static void main(String[] args) { System.out.println("OK"); } }
EOF
javac Main.java
expect_output OK java Main
mkdir judge-java
class_name="$(bash /usr/local/libexec/compile-java.sh "$WORKING_DIRECTORY/Main.java" "$WORKING_DIRECTORY/judge-java" 2>judge-java/message.txt)"
expect_output OK java -classpath judge-java "$class_name"

cat > Main.kt <<'EOF'
fun main() = println("OK")
EOF
for version in 1.5 1.6 1.7 1.8 1.9; do
    rm -rf "kotlin-$version"
    kotlinc Main.kt -language-version "$version" -d "kotlin-$version"
    expect_output OK kotlin -classpath "kotlin-$version" MainKt
done

cat > main.pas <<'EOF'
program Main;
begin
  WriteLn('OK');
end.
EOF
for optimize in - 1 2 3 4; do
    fpc -vw "-O$optimize" "-omain-pascal-$optimize" main.pas >/dev/null
done
expect_output OK ./main-pascal-2

cat > main.py <<'EOF'
print("OK")
EOF
for python in python2.7 python3.9 python3.10; do
    "$python" -m py_compile main.py
    expect_output OK "$python" main.py
    mkdir "judge-$python"
    mkdir "source-$python"
    cp main.py "source-$python/"
    bash /usr/local/libexec/compile-python.sh "$python" "$WORKING_DIRECTORY/source-$python" "$WORKING_DIRECTORY/judge-$python"
    expect_output OK "$python" "judge-$python/main.py"
done

cat > main.rs <<'EOF'
fn main() { println!("OK"); }
EOF
for edition in 2015 2018 2021 2024; do
    rustc --edition="$edition" -Copt-level=2 main.rs -o "rust-$edition"
    expect_output OK "./rust-$edition"
done
for optimize in 0 1 2 3; do
    rustc --edition=2024 -Copt-level="$optimize" main.rs -o "rust-O$optimize"
done

cat > main.swift <<'EOF'
print("OK")
EOF
for version in 4.2 5 6; do
    swiftc -swift-version "$version" -O main.swift -o "swift-$version"
    expect_output OK "./swift-$version"
done
for optimize in Onone O Ounchecked; do
    swiftc -swift-version 6 "-$optimize" main.swift -o "swift-$optimize"
done

cat > main.go <<'EOF'
package main
import "fmt"
func main() { fmt.Println("OK") }
EOF
GOCACHE="$WORKING_DIRECTORY/go-cache" go build -o main-go main.go
expect_output OK ./main-go

cat > main.hs <<'EOF'
main = putStrLn "OK"
EOF
for edition in Haskell98 Haskell2010 GHC2021; do
    ghc main.hs -X"$edition" -O2 -dynamic -v0 -outputdir "ghc-$edition" -o "haskell-$edition"
    expect_output OK "./haskell-$edition"
done

cat > Main.cs <<'EOF'
public static class MainClass {
    public static void Main() { System.Console.WriteLine("OK"); }
}
EOF
for version in 7.3 8 9 10 11 12 13 14; do
    csc -nologo -langversion:"$version" -out:"csharp-$version.exe" Main.cs
    expect_output OK mono "csharp-$version.exe"
done

cat > Main.fs <<'EOF'
printfn "OK"
EOF
fsharpc --nologo --out:fsharp.exe Main.fs
expect_output OK mono fsharp.exe

cat > testlib.cpp <<'EOF'
#include <testlib.h>
#include <iostream>
int main() { std::cout << "OK\n"; }
EOF
g++ -std=c++20 testlib.cpp -o testlib
expect_output OK ./testlib

echo "LibreOJ rootfs smoke test passed"
