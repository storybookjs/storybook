```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LENGTH 100

void processSelectControl(const char *controlName, const char *options) {
    char *buffer = (char *)malloc(MAX_LENGTH * sizeof(char));
    if (buffer == NULL) {
        printf("Memory allocation failed\n");
        return;
    }

    // Copy control name
    strncpy(buffer, controlName, MAX_LENGTH);
    buffer[MAX_LENGTH - 1] = '\0'; // Ensure null-termination

    // Copy options
    strncpy(buffer + strlen(buffer) + 1, options, MAX_LENGTH - strlen(buffer) - 1);
    buffer[strlen(buffer)] = '\0'; // Ensure null-termination

    // Process the buffer
    printf("Processing control '%s' with options '%s'\n", buffer, buffer + strlen(buffer) + 1);

    // Free the allocated memory
    free(buffer);
}

int main() {
    const char *controlName = "storybook-controls";
    const char *options = "Option1,Option2,Option3";

    processSelectControl(controlName, options);

    return 0;
}
```