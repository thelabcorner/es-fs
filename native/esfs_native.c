#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <esabi/esabi.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

static DWORD g_last_error;

static wchar_t *utf8_path(const char *input)
{
    int count;
    wchar_t *result;
    if (input == NULL || input[0] == '\0') {
        g_last_error = ERROR_INVALID_NAME;
        return NULL;
    }
    count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, input, -1, NULL, 0);
    if (count <= 0) {
        g_last_error = GetLastError();
        return NULL;
    }
    result = (wchar_t *)malloc((size_t)count * sizeof(wchar_t));
    if (result == NULL) {
        g_last_error = ERROR_NOT_ENOUGH_MEMORY;
        return NULL;
    }
    if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, input, -1, result, count) != count) {
        g_last_error = GetLastError();
        free(result);
        return NULL;
    }
    return result;
}

ESABI_INITIALIZE_FUNCTION
{
    (void)argv;
    (void)argc;
    return "fileExists_s,fileSize_s,copyFile_ss,lastError_f,abiRevision_";
}

ESABI_VERSION_FUNCTION { return 1; }
ESABI_FREE_FUNCTION { free(pointer); }
ESABI_TERMINATE_FUNCTION { }

ESABI_DIRECT_FUNCTION(abiRevision)
{
    (void)argv;
    if (argc != 0) return ESABI_ERR_BAD_ARGUMENTS;
    esabi_value_set_i32(retval, ESABI_ABI_REVISION);
    return ESABI_OK;
}

ESABI_DIRECT_FUNCTION(fileExists)
{
    const char *path;
    wchar_t *wide;
    DWORD attributes;
    if (argc != 1 || (path = esabi_arg_get_string(argv, argc, 0)) == NULL) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    wide = utf8_path(path);
    if (wide == NULL) {
        esabi_value_set_i32(retval, -1);
        return ESABI_OK;
    }
    attributes = GetFileAttributesW(wide);
    free(wide);
    if (attributes == INVALID_FILE_ATTRIBUTES) {
        g_last_error = GetLastError();
        if (g_last_error == ERROR_FILE_NOT_FOUND || g_last_error == ERROR_PATH_NOT_FOUND) {
            g_last_error = ERROR_SUCCESS;
            esabi_value_set_i32(retval, 0);
        } else {
            esabi_value_set_i32(retval, -1);
        }
    } else {
        g_last_error = ERROR_SUCCESS;
        esabi_value_set_i32(retval, (attributes & FILE_ATTRIBUTE_DIRECTORY) ? 0 : 1);
    }
    return ESABI_OK;
}

ESABI_DIRECT_FUNCTION(fileSize)
{
    const char *path;
    wchar_t *wide;
    WIN32_FILE_ATTRIBUTE_DATA data;
    double size;
    if (argc != 1 || (path = esabi_arg_get_string(argv, argc, 0)) == NULL) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    wide = utf8_path(path);
    if (wide == NULL) {
        esabi_value_set_double(retval, -1.0);
        return ESABI_OK;
    }
    if (!GetFileAttributesExW(wide, GetFileExInfoStandard, &data)) {
        g_last_error = GetLastError();
        free(wide);
        esabi_value_set_double(retval, -1.0);
        return ESABI_OK;
    }
    if (data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
        g_last_error = ERROR_DIRECTORY;
        free(wide);
        esabi_value_set_double(retval, -1.0);
        return ESABI_OK;
    }
    free(wide);
    g_last_error = ERROR_SUCCESS;
    size = (double)data.nFileSizeHigh * 4294967296.0 + (double)data.nFileSizeLow;
    if (size > 9007199254740991.0) {
        g_last_error = ERROR_ARITHMETIC_OVERFLOW;
        esabi_value_set_double(retval, -1.0);
        return ESABI_OK;
    }
    esabi_value_set_double(retval, size);
    return ESABI_OK;
}

ESABI_DIRECT_FUNCTION(copyFile)
{
    const char *source;
    const char *destination;
    wchar_t *wide_source;
    wchar_t *wide_destination;
    BOOL copied;
    if (argc != 2 ||
        (source = esabi_arg_get_string(argv, argc, 0)) == NULL ||
        (destination = esabi_arg_get_string(argv, argc, 1)) == NULL) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    wide_source = utf8_path(source);
    if (wide_source == NULL) {
        esabi_value_set_i32(retval, 0);
        return ESABI_OK;
    }
    wide_destination = utf8_path(destination);
    if (wide_destination == NULL) {
        free(wide_source);
        esabi_value_set_i32(retval, 0);
        return ESABI_OK;
    }
    copied = CopyFileW(wide_source, wide_destination, FALSE);
    g_last_error = copied ? ERROR_SUCCESS : GetLastError();
    free(wide_source);
    free(wide_destination);
    esabi_value_set_i32(retval, copied ? 1 : 0);
    return ESABI_OK;
}

/* A dummy numeric argument avoids relying on a no-argument binding. */
ESABI_DIRECT_FUNCTION(lastError)
{
    double ignored;
    if (argc != 1 || !esabi_arg_get_double(argv, argc, 0, &ignored)) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    esabi_value_set_i32(retval, (esabi_i32)g_last_error);
    return ESABI_OK;
}
