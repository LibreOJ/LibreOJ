#define _GNU_SOURCE

#include <errno.h>
#include <fcntl.h>
#include <sched.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static int inspect(void)
{
    char hostname[256];
    char working_directory[1024];
    char input[64] = {0};
    cpu_set_t affinity;
    struct rlimit stack_limit;

    if (gethostname(hostname, sizeof(hostname)) != 0 || getcwd(working_directory, sizeof(working_directory)) == NULL ||
        fgets(input, sizeof(input), stdin) == NULL || sched_getaffinity(0, sizeof(affinity), &affinity) != 0 ||
        getrlimit(RLIMIT_STACK, &stack_limit) != 0)
        return 10;
    input[strcspn(input, "\r\n")] = '\0';

    FILE *created = fopen("/sandbox/working/created-by-sandbox", "w");
    if (created == NULL)
        return 11;
    fputs("created\n", created);
    fclose(created);

    errno = 0;
    int readonly = open("/sandbox/binary/forbidden", O_WRONLY | O_CREAT, 0644);
    if (readonly != -1)
    {
        close(readonly);
        return 12;
    }
    const int readonly_error = errno;

    printf("uid=%u\n", getuid());
    printf("gid=%u\n", getgid());
    printf("hostname=%s\n", hostname);
    printf("environment=%s\n", getenv("DEMO_VALUE"));
    printf("working_directory=%s\n", working_directory);
    printf("stdin=%s\n", input);
    printf("proc=%s\n", access("/proc/self/status", R_OK) == 0 ? "available" : "missing");
    int affinity_cpu = -1;
    for (int cpu = 0; cpu < CPU_SETSIZE; ++cpu)
        if (CPU_ISSET(cpu, &affinity))
        {
            affinity_cpu = cpu;
            break;
        }
    printf("affinity=%d\n", CPU_COUNT(&affinity) == 1 ? affinity_cpu : -1);
    printf("readonly=%s\n", readonly_error == EROFS ? "EROFS" : strerror(readonly_error));
    printf("stack_limit=%llu\n", (unsigned long long)stack_limit.rlim_cur);
    return 0;
}

static int exhaust_processes(void)
{
    pid_t children[64];
    size_t count = 0;
    while (count < sizeof(children) / sizeof(children[0]))
    {
        const pid_t child = fork();
        if (child == -1)
        {
            if (errno != EAGAIN)
                return 20;
            break;
        }
        if (child == 0)
        {
            pause();
            _exit(0);
        }
        children[count++] = child;
    }

    printf("forked=%zu\n", count);
    for (size_t index = 0; index < count; ++index)
        kill(children[index], SIGKILL);
    for (size_t index = 0; index < count; ++index)
        waitpid(children[index], NULL, 0);
    return 0;
}

int main(int argc, char **argv)
{
    if (argc < 2)
        return 2;
    if (strcmp(argv[1], "inspect") == 0)
        return inspect();
    if (strcmp(argv[1], "exit") == 0 && argc == 3)
        return atoi(argv[2]);
    if (strcmp(argv[1], "signal") == 0)
    {
        *(volatile int *)0 = 1;
        return 3;
    }
    if (strcmp(argv[1], "cpu") == 0)
    {
        volatile uint64_t value = 0;
        while (1)
            value++;
    }
    if (strcmp(argv[1], "memory") == 0 && argc == 3)
    {
        const size_t size = strtoull(argv[2], NULL, 10);
        char *memory = malloc(size);
        if (memory == NULL)
            return 4;
        for (size_t offset = 0; offset < size; offset += 4096)
            memory[offset] = 1;
        pause();
        return 0;
    }
    if (strcmp(argv[1], "pids") == 0)
        return exhaust_processes();
    if (strcmp(argv[1], "descendants") == 0)
    {
        if (fork() == 0)
        {
            if (fork() == 0)
                while (1)
                    pause();
            while (1)
                pause();
        }
        while (1)
            pause();
    }
    return 5;
}
