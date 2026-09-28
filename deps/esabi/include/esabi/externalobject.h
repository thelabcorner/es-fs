/*
 * esabi - ExtendScript ExternalObject ABI declarations
 * SPDX-License-Identifier: MIT
 *
 * Copyright (c) 2026 TheDabCorner LLC and Jackson Cummings
 *
 * Independent interface declaration for interoperating with ExtendScript
 * ExternalObject hosts. The layout and numeric constants below are interface
 * facts; the naming, organization, diagnostics, and helper surface are esabi's.
 */

#ifndef ESABI_EXTERNALOBJECT_H
#define ESABI_EXTERNALOBJECT_H

#include <float.h>
#include <limits.h>
#include <stddef.h>
#include <stdint.h>

#define ESABI_VERSION_MAJOR 0
#define ESABI_VERSION_MINOR 3
#define ESABI_VERSION_PATCH 1
#define ESABI_VERSION_STRING "0.3.1"
#define ESABI_ABI_REVISION  1

/*
 * The historical interface is expressed in terms of C long. That is 32 bits
 * on Windows (LLP64) but 64 bits on LP64 targets. Make that ABI choice
 * explicit instead of letting the compiler silently change record layout.
 */
#define ESABI_ABI_PROFILE_LONG32 1
#define ESABI_ABI_PROFILE_LONG64 2

#ifndef ESABI_ABI_PROFILE
#if defined(_WIN32)
#define ESABI_ABI_PROFILE ESABI_ABI_PROFILE_LONG32
#else
#error "esabi: select ESABI_ABI_PROFILE explicitly on non-Windows targets"
#endif
#endif

#if ESABI_ABI_PROFILE == ESABI_ABI_PROFILE_LONG32
typedef int32_t  esabi_long;
typedef uint32_t esabi_ulong;
#define ESABI_ABI_PROFILE_NAME      "LONG32"
#define ESABI_ABI_LONG_BITS       32
#define ESABI_VALUE_SIZE          16
#define ESABI_VALUE_TYPE_OFFSET   8
#define ESABI_VALUE_RESERVED_OFFSET 12
#elif ESABI_ABI_PROFILE == ESABI_ABI_PROFILE_LONG64
typedef int64_t  esabi_long;
typedef uint64_t esabi_ulong;
#define ESABI_ABI_PROFILE_NAME      "LONG64"
#define ESABI_ABI_LONG_BITS       64
#define ESABI_VALUE_SIZE          24
#define ESABI_VALUE_TYPE_OFFSET   8
#define ESABI_VALUE_RESERVED_OFFSET 16
#else
#error "esabi: unknown ESABI_ABI_PROFILE"
#endif

#define ESABI_PAYLOAD_SIZE    8
#define ESABI_VALUE_ALIGNMENT 8

#ifndef ESABI_EXPORT
#if defined(_WIN32)
#define ESABI_EXPORT __declspec(dllexport)
#elif defined(__GNUC__) || defined(__clang__)
#define ESABI_EXPORT __attribute__((visibility("default")))
#else
#define ESABI_EXPORT
#endif
#endif

/*
 * ExternalObject's historical C ABI uses the platform's default C calling
 * convention. Making cdecl explicit on 32-bit Windows prevents /Gz or similar
 * project-wide switches from silently changing exported entry points.
 */
#ifndef ESABI_CALL
#if defined(_WIN32)
#define ESABI_CALL __cdecl
#else
#define ESABI_CALL
#endif
#endif

#if defined(__cplusplus)
#define ESABI_EXTERN_C extern "C"
#if __cplusplus >= 201103L
#define ESABI_NOEXCEPT noexcept
#else
#define ESABI_NOEXCEPT
#endif
#else
#define ESABI_EXTERN_C extern
#define ESABI_NOEXCEPT
#endif

typedef int32_t esabi_i32;
typedef uint32_t esabi_u32;
typedef esabi_long esabi_type;
typedef esabi_long esabi_error;

typedef struct esabi_live_object_opaque *esabi_live_object;

/*
 * The payload is always an 8-byte slot. raw_bits exists both for diagnostics
 * and so helper code can clear the entire slot without libc or representation
 * assumptions about pointers or floating-point zero.
 */
#pragma pack(push, 8)
typedef union esabi_payload {
    uint64_t          raw_bits;
    esabi_long        signed_value;
    esabi_ulong       unsigned_value;
    double            double_value;
    char             *string_value;
    esabi_live_object object_value;
} esabi_payload;

typedef struct esabi_value {
    esabi_payload payload;
    esabi_type    type;
    esabi_long    reserved;
} esabi_value;
#pragma pack(pop)

enum {
    ESABI_TYPE_UNDEFINED           = 0,
    ESABI_TYPE_BOOL                = 2,
    ESABI_TYPE_DOUBLE              = 3,
    ESABI_TYPE_STRING              = 4,
    ESABI_TYPE_LIVE_OBJECT         = 6,
    ESABI_TYPE_LIVE_OBJECT_RELEASE = 7,
    ESABI_TYPE_INTEGER             = 123,
    ESABI_TYPE_UINTEGER            = 124,
    ESABI_TYPE_SCRIPT              = 125
};

enum {
    ESABI_OK                        = 0,
    ESABI_ERR_NO_ASSIGNMENT_TARGET = 3,
    ESABI_ERR_UNTERMINATED_STRING  = 4,
    ESABI_ERR_BAD_DIGIT            = 6,
    ESABI_ERR_SYNTAX               = 8,
    ESABI_ERR_BAD_ARGUMENTS        = 20,
    ESABI_ERR_OUT_OF_MEMORY        = -28,
    ESABI_ERR_UNCAUGHT_EXCEPTION   = -29,
    ESABI_ERR_BAD_URI              = 31,
    ESABI_ERR_BAD_ACTION           = 32,
    ESABI_ERR_INTERNAL             = -33,
    ESABI_ERR_NOT_IMPLEMENTED      = -36,
    ESABI_ERR_RANGE                = 41,
    ESABI_ERR_EVAL                 = 43,
    ESABI_ERR_CONVERSION           = 44,
    ESABI_ERR_INVALID_OBJECT       = 45,
    ESABI_ERR_TYPE_MISMATCH        = 47,
    ESABI_ERR_NO_FILE              = 48,
    ESABI_ERR_FILE_EXISTS          = 49,
    ESABI_ERR_NOT_OPEN             = 50,
    ESABI_ERR_EOF                  = 51,
    ESABI_ERR_IO                   = 52,
    ESABI_ERR_PERMISSION           = 53,
    ESABI_ERR_CANNOT_RESOLVE       = 57,
    ESABI_ERR_IO_TIMEOUT           = 58,
    ESABI_ERR_NO_RESPONSE          = 59
};

#define ESABI_SIG_ANY    "a"
#define ESABI_SIG_BOOL   "b"
#define ESABI_SIG_I32    "d"
#define ESABI_SIG_U32    "u"
#define ESABI_SIG_DOUBLE "f"
#define ESABI_SIG_STRING "s"
#define ESABI_SIGNATURE_SEPARATOR ","

#define ESABI_DETAIL_STRINGIFY_INNER(value) #value
#define ESABI_DETAIL_STRINGIFY(value) ESABI_DETAIL_STRINGIFY_INNER(value)
#define ESABI_SIGNATURE0(name) ESABI_DETAIL_STRINGIFY(name) "_"
#define ESABI_SIGNATURE(name, arguments) \
    ESABI_DETAIL_STRINGIFY(name) "_" arguments

#define ESABI_ENTRY_INITIALIZE "ESInitialize"
#define ESABI_ENTRY_VERSION    "ESGetVersion"
#define ESABI_ENTRY_FREE       "ESFreeMem"
#define ESABI_ENTRY_TERMINATE  "ESTerminate"

typedef esabi_error (ESABI_CALL *esabi_function)(
    esabi_value *argv,
    esabi_long argc,
    esabi_value *retval
);

#define ESABI_DIRECT_FUNCTION(name) \
    ESABI_EXTERN_C ESABI_EXPORT esabi_error ESABI_CALL name( \
        esabi_value *argv, esabi_long argc, esabi_value *retval) ESABI_NOEXCEPT

#define ESABI_INITIALIZE_FUNCTION \
    ESABI_EXTERN_C ESABI_EXPORT char *ESABI_CALL ESInitialize( \
        esabi_value *argv, esabi_long argc) ESABI_NOEXCEPT

#define ESABI_VERSION_FUNCTION \
    ESABI_EXTERN_C ESABI_EXPORT esabi_long ESABI_CALL ESGetVersion(void) ESABI_NOEXCEPT

#define ESABI_FREE_FUNCTION \
    ESABI_EXTERN_C ESABI_EXPORT void ESABI_CALL ESFreeMem(void *pointer) ESABI_NOEXCEPT

#define ESABI_TERMINATE_FUNCTION \
    ESABI_EXTERN_C ESABI_EXPORT void ESABI_CALL ESTerminate(void) ESABI_NOEXCEPT

#if defined(__cplusplus)
#define ESABI_STATIC_ASSERT(expression, message) static_assert((expression), message)
#elif defined(__STDC_VERSION__) && (__STDC_VERSION__ >= 201112L)
#define ESABI_STATIC_ASSERT(expression, message) _Static_assert((expression), message)
#else
#define ESABI_DETAIL_JOIN_INNER(a, b) a##b
#define ESABI_DETAIL_JOIN(a, b) ESABI_DETAIL_JOIN_INNER(a, b)
#define ESABI_STATIC_ASSERT(expression, message) \
    typedef char ESABI_DETAIL_JOIN(esabi_static_assert_, __LINE__)[(expression) ? 1 : -1]
#endif

#if defined(__cplusplus)
#define ESABI_ALIGNOF(type) alignof(type)
#elif defined(_MSC_VER)
#define ESABI_ALIGNOF(type) __alignof(type)
#elif defined(__STDC_VERSION__) && (__STDC_VERSION__ >= 201112L)
#define ESABI_ALIGNOF(type) _Alignof(type)
#elif defined(__GNUC__) || defined(__clang__)
#define ESABI_ALIGNOF(type) __alignof__(type)
#endif

ESABI_STATIC_ASSERT(CHAR_BIT == 8, "esabi requires 8-bit bytes");
ESABI_STATIC_ASSERT(sizeof(esabi_i32) == 4, "esabi_i32 must be 32 bits");
ESABI_STATIC_ASSERT(sizeof(esabi_u32) == 4, "esabi_u32 must be 32 bits");
ESABI_STATIC_ASSERT(sizeof(esabi_long) * CHAR_BIT == ESABI_ABI_LONG_BITS,
                    "ABI long width does not match selected esabi profile");
ESABI_STATIC_ASSERT(sizeof(esabi_ulong) == sizeof(esabi_long),
                    "signed and unsigned ABI words must have equal width");
ESABI_STATIC_ASSERT(INT32_MIN == (-2147483647 - 1), "esabi requires two's-complement int32");
ESABI_STATIC_ASSERT(INT32_MAX == 2147483647, "unexpected int32 maximum");
ESABI_STATIC_ASSERT(UINT32_MAX == UINT32_C(4294967295), "unexpected uint32 maximum");
ESABI_STATIC_ASSERT(sizeof(double) == 8, "ExternalObject ABI requires 64-bit double");
ESABI_STATIC_ASSERT(DBL_MANT_DIG == 53 && DBL_MAX_EXP == 1024,
                    "ExternalObject ABI requires IEEE-754 binary64 double");
ESABI_STATIC_ASSERT(sizeof(void *) == 4 || sizeof(void *) == 8,
                    "esabi supports 32-bit and 64-bit pointer ABIs");
#if ESABI_ABI_PROFILE == ESABI_ABI_PROFILE_LONG64
ESABI_STATIC_ASSERT(sizeof(void *) == 8,
                    "LONG64 profile requires a 64-bit pointer ABI");
#endif
ESABI_STATIC_ASSERT(sizeof(esabi_live_object) == sizeof(void *),
                    "LiveObject handle must be pointer-sized");
ESABI_STATIC_ASSERT(sizeof(esabi_payload) == ESABI_PAYLOAD_SIZE,
                    "ExternalObject payload size does not match profile");
ESABI_STATIC_ASSERT(sizeof(esabi_value) == ESABI_VALUE_SIZE,
                    "ExternalObject value size does not match profile");
ESABI_STATIC_ASSERT(offsetof(esabi_value, payload) == 0, "payload offset must be 0");
ESABI_STATIC_ASSERT(offsetof(esabi_value, type) == ESABI_VALUE_TYPE_OFFSET,
                    "type offset does not match profile");
ESABI_STATIC_ASSERT(offsetof(esabi_value, reserved) == ESABI_VALUE_RESERVED_OFFSET,
                    "reserved offset does not match profile");
ESABI_STATIC_ASSERT(sizeof(((esabi_value *)0)->reserved) == sizeof(esabi_long),
                    "reserved field width must match ABI long width");
#ifdef ESABI_ALIGNOF
ESABI_STATIC_ASSERT(ESABI_ALIGNOF(esabi_value) == ESABI_VALUE_ALIGNMENT,
                    "ExternalObject value alignment does not match profile");
#endif

ESABI_INITIALIZE_FUNCTION;
ESABI_VERSION_FUNCTION;
ESABI_FREE_FUNCTION;
ESABI_TERMINATE_FUNCTION;

#undef ESABI_STATIC_ASSERT
#ifdef ESABI_DETAIL_JOIN
#undef ESABI_DETAIL_JOIN
#endif
#ifdef ESABI_DETAIL_JOIN_INNER
#undef ESABI_DETAIL_JOIN_INNER
#endif
#ifdef ESABI_ALIGNOF
#undef ESABI_ALIGNOF
#endif

#endif /* ESABI_EXTERNALOBJECT_H */
