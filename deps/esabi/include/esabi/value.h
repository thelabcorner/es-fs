/*
 * esabi - zero-cost helpers for esabi_value
 * SPDX-License-Identifier: MIT
 */

#ifndef ESABI_VALUE_H
#define ESABI_VALUE_H

#include "externalobject.h"

#if defined(_MSC_VER) && !defined(__clang__)
#define ESABI_INLINE static __inline
#else
#define ESABI_INLINE static inline
#endif

#if defined(__GNUC__) || defined(__clang__)
#define ESABI_WARN_UNUSED __attribute__((warn_unused_result))
#else
#define ESABI_WARN_UNUSED
#endif

ESABI_WARN_UNUSED ESABI_INLINE int esabi_error_is_ok(esabi_error error)
{
    return error == ESABI_OK;
}

ESABI_WARN_UNUSED ESABI_INLINE int esabi_error_is_fatal(esabi_error error)
{
    return error < 0;
}

ESABI_WARN_UNUSED ESABI_INLINE int esabi_type_is_known(esabi_type type)
{
    switch (type) {
        case ESABI_TYPE_UNDEFINED:
        case ESABI_TYPE_BOOL:
        case ESABI_TYPE_DOUBLE:
        case ESABI_TYPE_STRING:
        case ESABI_TYPE_LIVE_OBJECT:
        case ESABI_TYPE_LIVE_OBJECT_RELEASE:
        case ESABI_TYPE_INTEGER:
        case ESABI_TYPE_UINTEGER:
        case ESABI_TYPE_SCRIPT:
            return 1;
        default:
            return 0;
    }
}

ESABI_INLINE void esabi_value_reset(esabi_value *value)
{
    if (value == NULL) return;
    value->payload.raw_bits = UINT64_C(0);
    value->type = ESABI_TYPE_UNDEFINED;
    value->reserved = 0;
}

ESABI_INLINE void esabi_value_set_undefined(esabi_value *value)
{
    esabi_value_reset(value);
}

ESABI_WARN_UNUSED ESABI_INLINE int esabi_value_is(const esabi_value *value, esabi_type type)
{
    return value != NULL && value->type == type;
}

ESABI_INLINE void esabi_value_set_bool(esabi_value *value, int truthy)
{
    esabi_value_reset(value);
    if (value != NULL) {
        value->payload.signed_value = truthy ? 1 : 0;
        value->type = ESABI_TYPE_BOOL;
    }
}

ESABI_INLINE void esabi_value_set_i32(esabi_value *value, esabi_i32 number)
{
    esabi_value_reset(value);
    if (value != NULL) {
        value->payload.signed_value = (esabi_long)number;
        value->type = ESABI_TYPE_INTEGER;
    }
}

ESABI_INLINE void esabi_value_set_u32(esabi_value *value, esabi_u32 number)
{
    esabi_value_reset(value);
    if (value != NULL) {
        value->payload.unsigned_value = (esabi_ulong)number;
        value->type = ESABI_TYPE_UINTEGER;
    }
}

ESABI_INLINE void esabi_value_set_double(esabi_value *value, double number)
{
    esabi_value_reset(value);
    if (value != NULL) {
        value->payload.double_value = number;
        value->type = ESABI_TYPE_DOUBLE;
    }
}

/*
 * These setters encode a pointer only. They do not allocate, copy, or transfer
 * ownership. For returned strings/scripts, ESFreeMem must match the allocator
 * used by the library.
 */
ESABI_INLINE void esabi_value_set_string(esabi_value *value, char *utf8)
{
    esabi_value_reset(value);
    if (value != NULL) {
        value->payload.string_value = utf8;
        value->type = ESABI_TYPE_STRING;
    }
}

ESABI_INLINE void esabi_value_set_script(esabi_value *value, char *utf8_script)
{
    esabi_value_reset(value);
    if (value != NULL) {
        value->payload.string_value = utf8_script;
        value->type = ESABI_TYPE_SCRIPT;
    }
}

ESABI_INLINE void esabi_value_set_live_object(
    esabi_value *value,
    esabi_live_object object)
{
    esabi_value_reset(value);
    if (value != NULL) {
        value->payload.object_value = object;
        value->type = ESABI_TYPE_LIVE_OBJECT;
    }
}

ESABI_INLINE void esabi_value_set_live_object_release(
    esabi_value *value,
    esabi_live_object object)
{
    esabi_value_reset(value);
    if (value != NULL) {
        value->payload.object_value = object;
        value->type = ESABI_TYPE_LIVE_OBJECT_RELEASE;
    }
}

ESABI_WARN_UNUSED ESABI_INLINE int esabi_value_get_bool(const esabi_value *value, int *out)
{
    if (value == NULL || out == NULL || value->type != ESABI_TYPE_BOOL) return 0;
    *out = value->payload.signed_value != 0;
    return 1;
}

ESABI_WARN_UNUSED ESABI_INLINE int esabi_value_get_i32(const esabi_value *value, esabi_i32 *out)
{
    if (value == NULL || out == NULL || value->type != ESABI_TYPE_INTEGER) return 0;
#if ESABI_ABI_PROFILE == ESABI_ABI_PROFILE_LONG64
    if (value->payload.signed_value < (esabi_long)INT32_MIN ||
        value->payload.signed_value > (esabi_long)INT32_MAX) return 0;
#endif
    *out = (esabi_i32)value->payload.signed_value;
    return 1;
}

ESABI_WARN_UNUSED ESABI_INLINE int esabi_value_get_u32(const esabi_value *value, esabi_u32 *out)
{
    if (value == NULL || out == NULL || value->type != ESABI_TYPE_UINTEGER) return 0;
#if ESABI_ABI_PROFILE == ESABI_ABI_PROFILE_LONG64
    if (value->payload.unsigned_value > (esabi_ulong)UINT32_MAX) return 0;
#endif
    *out = (esabi_u32)value->payload.unsigned_value;
    return 1;
}

ESABI_WARN_UNUSED ESABI_INLINE int esabi_value_get_double(const esabi_value *value, double *out)
{
    if (value == NULL || out == NULL || value->type != ESABI_TYPE_DOUBLE) return 0;
    *out = value->payload.double_value;
    return 1;
}

ESABI_WARN_UNUSED ESABI_INLINE const char *esabi_value_get_string(const esabi_value *value)
{
    return value != NULL && value->type == ESABI_TYPE_STRING
        ? value->payload.string_value : NULL;
}

ESABI_WARN_UNUSED ESABI_INLINE const char *esabi_value_get_script(const esabi_value *value)
{
    return value != NULL && value->type == ESABI_TYPE_SCRIPT
        ? value->payload.string_value : NULL;
}

ESABI_WARN_UNUSED ESABI_INLINE esabi_live_object esabi_value_get_live_object(const esabi_value *value)
{
    if (value == NULL ||
        (value->type != ESABI_TYPE_LIVE_OBJECT &&
         value->type != ESABI_TYPE_LIVE_OBJECT_RELEASE)) {
        return NULL;
    }
    return value->payload.object_value;
}

/*
 * Bounds-checked argument access. A negative argc/index or a NULL argv is
 * rejected before pointer arithmetic occurs.
 */
ESABI_WARN_UNUSED ESABI_INLINE const esabi_value *esabi_arg_at(
    const esabi_value *argv,
    esabi_long argc,
    esabi_long index)
{
    if (argv == NULL || argc < 0 || index < 0 || index >= argc) return NULL;
    return argv + (size_t)index;
}

ESABI_WARN_UNUSED ESABI_INLINE int esabi_arg_get_bool(
    const esabi_value *argv,
    esabi_long argc,
    esabi_long index,
    int *out)
{
    return esabi_value_get_bool(esabi_arg_at(argv, argc, index), out);
}

ESABI_WARN_UNUSED ESABI_INLINE int esabi_arg_get_i32(
    const esabi_value *argv,
    esabi_long argc,
    esabi_long index,
    esabi_i32 *out)
{
    return esabi_value_get_i32(esabi_arg_at(argv, argc, index), out);
}

ESABI_WARN_UNUSED ESABI_INLINE int esabi_arg_get_u32(
    const esabi_value *argv,
    esabi_long argc,
    esabi_long index,
    esabi_u32 *out)
{
    return esabi_value_get_u32(esabi_arg_at(argv, argc, index), out);
}

ESABI_WARN_UNUSED ESABI_INLINE int esabi_arg_get_double(
    const esabi_value *argv,
    esabi_long argc,
    esabi_long index,
    double *out)
{
    return esabi_value_get_double(esabi_arg_at(argv, argc, index), out);
}

ESABI_WARN_UNUSED ESABI_INLINE const char *esabi_arg_get_string(
    const esabi_value *argv,
    esabi_long argc,
    esabi_long index)
{
    return esabi_value_get_string(esabi_arg_at(argv, argc, index));
}

#undef ESABI_INLINE
#undef ESABI_WARN_UNUSED

#endif /* ESABI_VALUE_H */
